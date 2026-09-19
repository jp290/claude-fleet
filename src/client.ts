import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { CanvasAddon } from "@xterm/addon-canvas";
import { WebglAddon } from "@xterm/addon-webgl";
import qrcode from "qrcode-generator";
import { mdInto, type MdEntityKind } from "./md";
import { selectionMarkdown } from "./mdcopy";
import { Flakes } from "./flakes";
import { harnessMark, icon, type IconName } from "./icons";
import { modelLabel } from "./modelname";
import { attachEntityCards, type EntFacts } from "./entcard";
import { loadChatSizes, sizePanel, stepChatSizes } from "./chatsize";
import { RECONNECT_SETTLED_MS, reconnectDelay } from "./backoff";
import { pollPlan } from "./pollplan";
import { gitUnquote, porcelainPath } from "./gitpath";
import { matchTree, treeOf, type TreeNode } from "./filetree";
import { PLA_ACK_KEY, postLandAlarm } from "./plaudit";
import { PANE_ACK_STALE_MS, opsOpen, opsUnacked, opsSubject, opsSummary, type OpsPollRow } from "./opsevents";
import {
  projectTaskWaves,
  type ProjectedWaveTask, type TaskCardSize, type TaskWaveProjection, type TaskWaveUnresolved,
} from "../task-waves";
import { projectLandWaves, LAND_WAVE_COSTS_2026_09, LAND_WAVE_ROWS_MAX,
  type LandWave, type LandWaveCosts, type LandWaveProjection } from "../task-land-waves";
// the same first-sentence reduction the dispatched notes block renders with — imported rather than
// re-spelled so the wave evidence and the brief's note lines cut a row at the same place
import { noteFirstSentence } from "../task-notes";
import type { Task as ServerTask } from "../server/types";
// everything this file and server.ts must say identically — see src/protocol.ts. Importing rather
// than re-declaring is what makes tsc, which gates every land, the thing that notices a drift.
import {
  WS_INPUT_MAX_BYTES, DISPOSITION_VERDICTS, INSTANCE_NAME_RE, INSTANCE_URL_RE, normalizeLaneAnchor,
  type GitInfo, type InstanceLink, type LaneAnchor, type PostLandAuditInfo, type PostLandAuditLiveInfo,
  type DispositionWorker, type DispositionVerdict,
} from "./protocol";
// the list-on-the-left / thing-in-full-on-the-right window shared by review, picker, queue and
// the outcome feed. Chrome only — every renderer below still owns its own rows and data.
import { openShell, type Shell, type ShellRow } from "./shell";

const $ = (id: string) => document.getElementById(id)!;
const slotsEl = $("slots"), dot = $("dot"),
  ta = $("input") as HTMLTextAreaElement, send = $("send") as HTMLButtonElement,
  gate = $("gate"), gateIn = $("gatein") as HTMLInputElement,
  chipsEl = $("chips"), panesEl = $("panes");

const RECENT_MS = 5000;
const MAX_CHUNK = WS_INPUT_MAX_BYTES; // the server drops a larger frame in silence — one number, both ends
const LAYOUTS: Record<string, number> = { "1": 1, "2": 2, "4": 4 };

// must match the mobile media query in index.html
const MOBILE_MQ = matchMedia("(max-width: 700px), ((pointer: coarse) and (max-height: 500px))");
const isMobile = () => MOBILE_MQ.matches;

let dataSaver = localStorage.getItem("fleet.datasaver") === "1";
const plan = () => pollPlan(document.hidden, dataSaver);

const mdot = $("mdot"), mtitle = $("mtitle");
function setConn(on: boolean) {
  for (const d of [dot, mdot]) d.className = `dot ${on ? "on" : "off"}`;
}

function setDrawer(open: boolean) {
  document.body.classList.toggle("drawer", open);
}
$("menu").onclick = () => setDrawer(true);
$("shade").onclick = () => setDrawer(false);
// mobile's #refresh (no layout switcher to force a reconnect through) and desktop's
// #reload (quicker than toggling panes, and works in single-pane layout too) both
// force the focused pane to reconnect — the server re-seeds scrollback at the
// reconnecting client's width, so this is "fix my wrapping" on demand either way
$("refresh").onclick = () => panes[focused]?.reconnect(); // mobile header (no per-pane controls there)

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
  localStorage.setItem("fleet.sidecollapsed", on ? "1" : "0");
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
let instanceName: string | null = null;
let instanceLinks: InstanceLink[] = [];
let instRendered = "";

const instMenuOpen = () => instMenu.classList.contains("open");
function setInstMenu(open: boolean) {
  instMenu.classList.toggle("open", open && instanceLinks.length > 0);
}
// the origin a link actually resolves to — `new URL` folds the default port away, so a list that
// spells this instance `http://host:80` still marks itself as "here" instead of offering a switch
// to the page you are already on. Safe without a guard: every survivor passed INSTANCE_URL_RE.
const instOriginOf = (url: string): string => new URL(url).origin;

function renderInstanceHead() {
  const key = JSON.stringify([instanceName, instanceLinks]);
  if (key === instRendered) return; // an open menu must survive the 2 s poll
  instRendered = key;
  if (instanceName === null && instanceLinks.length === 0) {
    // the ordinary single-host board, byte for byte as it was before this cut
    setInstMenu(false);
    instWrap.classList.remove("on");
    return;
  }
  instWrap.classList.add("on");
  const pick = instanceLinks.length > 0;
  instBtn.textContent = (instanceName ?? "unnamed") + (pick ? " ▾" : "");
  instBtn.classList.toggle("pick", pick);
  instBtn.title = instanceName === null
    ? "this fleet was given no FLEET_INSTANCE name"
    : `this board is served by the fleet instance “${instanceName}”`;
  instBtn.onclick = pick ? () => setInstMenu(!instMenuOpen()) : null;
  instMenu.replaceChildren(...instanceLinks.map((link) => {
    const here = instOriginOf(link.url) === location.origin;
    const row = el("button", `instrow${here ? " here" : ""}`);
    row.append(el("span", "instname", link.name), el("span", "insturl", here ? "you are here" : link.url));
    row.title = here ? `${link.name} — this board` : `open ${link.name} at ${link.url} (its own login)`;
    row.onclick = () => {
      setInstMenu(false);
      if (!here) location.assign(link.url);
    };
    return row;
  }));
  if (!pick) setInstMenu(false);
}

document.addEventListener("click", (e) => {
  if (instMenuOpen() && !instWrap.contains(e.target as Node)) setInstMenu(false);
}, true);
window.addEventListener("keydown", (e) => { if (e.key === "Escape" && instMenuOpen()) setInstMenu(false); });

// navigator.clipboard only exists in a secure context (HTTPS or localhost) — this
// dashboard is normally reached over plain HTTP via a Tailscale IP, so it's undefined
// there and this falls back to the legacy execCommand copy path
function copyText(text: string) {
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
function el(tag: string, className: string, text?: string): HTMLElement {
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

async function api(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, init);
  if (res.status === 401) showGate();
  return res;
}
const post = (path: string, body: unknown) =>
  api(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// --- fleet state ---
interface ShareInfo { id: string; password: string; created: number; guests: number; comments: number }
interface AutoInfo {
  id: string; slot: number; text: string; everySec: number | null; nextAt: number;
  runsLeft: number; idleSec: number; enabled: boolean; lastRun: number; lastResult: string | null;
}
interface WorktreeInfo { repo: string; branch: string; anchor?: LaneAnchor }
interface SlotInfo {
  id: number; cwd: string | null; label: string | null; lastOutput: number;
  // Both are optional for compatibility with an older server. `repo` is the canonical toplevel;
  // cwd can be a subdirectory and therefore cannot substitute for it in an ownership join.
  openedAt?: number; repo?: string | null;
  share?: ShareInfo | null; git?: GitInfo | null; worktree?: WorktreeInfo | null; mergePending?: boolean;
  // the spawn-time model the server already puts on the poll (server.ts, the /api/sessions row)
  model?: string | null;
  // which agent this session runs. ABSENT means the default harness — the server omits the field
  // when it is null (it is the 2 s poll), so absent and "claude" are the same state here too.
  harness?: string; effort?: string;
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
interface HarnessInfo { id: string; supports: { resume: boolean; transcript: boolean; model: boolean;
  effort: boolean; selfSchedule: boolean; container: boolean }; effortLevels: string[]; note: string | null; default: boolean;
  // the adapter's pick list for the composer's model switch (server.ts#Harness.models) — a menu,
  // not a gate; optional for an older server, which then gets the free-text field alone
  models?: string[];
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
const agentHarnesses = (): HarnessInfo[] => harnesses.filter((h) => (h.role ?? "agent") === "agent");
// what the 2 s poll carries per task — mirrors server.ts's TaskDigest. No `text`: the prompt
// bodies are fetched once from /api/tasks when the queue overlay opens (see loadTaskTexts).
// The optional fields are absent, not null, when unset.
// `source` is the SERVER's own union, imported rather than mirrored: the mirror said
// owner|intake|steward after ACP-23 added "main", and the `as` cast in refresh hid it, so every
// MAIN-filed row rendered as "owner". A new producer now fails tsc in taskSourceLabel's switch.
interface TaskInfo { id: string; source: ServerTask["source"];
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
  touched?: { sha: string; branch: string; at: number }[] }
// the proposal itself, as GET /api/tasks serves it (server.ts TaskRefine)
interface RefineChildView { text: string; doneCriterion?: string; verify?: string; files?: string[] }
interface TaskRefineFull { at: number; model: string;
  proposal: { unchanged: boolean; reason?: string; tasks?: RefineChildView[] };
  // the server's deterministic acceptance on that proposal (server.ts refineValidationFor,
  // refine-validate.ts): tracked-path and verify-contract findings, three-valued, per child. It
  // gates nothing here either — it is shown next to the apply button so the owner promotes a bad
  // proposal knowingly or not at all. ABSENT on an `unchanged` proposal, which has no children.
  validation?: { verdict: "pass" | "fail" | "unknown";
    findings: { code: string; severity: "error" | "unknown"; child: number; detail: string }[] } }
// `waveBudget` is the server's live FLEET_LAND_WAVE_BUDGET: the board's land fold must cut with the
// number the wave door checks, or it offers waves the door refuses. Absent on an older server.
interface DispatchInfo { available: boolean; on: boolean; maxLanes: number; repo: string; waveBudget?: number }
let fleet: SlotInfo[] = [];
// the harness catalogue, fetched ONCE (it is a server constant) the first time the picker opens.
// Empty until then, and every reader treats empty as "only the default exists" — so a failed or
// pending fetch degrades to exactly the pre-harness UI rather than to a broken one.
let harnesses: HarnessInfo[] = [];
let harnessesLoaded = false;
// this fleet's box defaults, from the same fetch — shown as the container fields' placeholders so
// the owner sees what leaving them empty gets. Never hardcoded here: they are server constants
// (FLEET_CONTAINER / FLEET_CONTAINER_CONTEXT), and a second copy would drift silently.
let containerDefaults: { container: string; containerContext: string } | null = null;
// what a null model launches on the DEFAULT adapter, from the same fetch. Shown as the model
// field's placeholder so "leave it empty" is a visible choice rather than a guess. Claude-only by
// construction (the server says so): a foreign adapter keeps its own implicit default, and the
// placeholder says "default" there rather than claiming this value applies to it.
let defaultModel: string | null = null;
async function loadHarnesses(): Promise<void> {
  if (harnessesLoaded) return;
  try {
    const res = await api("/api/harnesses");
    if (!res.ok) return;
    const cat = (await res.json()) as { harnesses: HarnessInfo[]; defaultModel?: string;
      containerDefaults?: { container: string; containerContext: string } };
    defaultModel = typeof cat.defaultModel === "string" ? cat.defaultModel : null;
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
// THE SLOT'S OWN ADAPTER ENTRY, for the surfaces that must show a control only where the harness
// carries it. Deliberately stricter than supportsOf(): that one answers "assume today's behaviour"
// for an unloaded catalogue, which is right for hiding a feature and wrong for OFFERING one — an
// optimistic default here would paint a model button on a pi slot. null therefore means "not
// answerable yet", and the caller renders nothing until loadHarnesses() has run.
function harnessEntry(slot: number): HarnessInfo | null {
  if (!harnesses.length) return null;
  const s = fleet.find((x) => x.id === slot);
  if (!s?.cwd) return null;
  return harnesses.find((h) => h.id === s.harness) ?? (s.harness ? null : harnesses.find((h) => h.default) ?? null);
}

// A live slot's model/effort has TWO halves and neither writes the other (CLAUDE.md, supervisor
// section, measured 2026-09-02): POST /api/slots/:id/model moves the RECORD and never touches the
// pane, `/model <id>` in the pane moves the agent and never touches the record. So the move is
// always a pair, record first — and if the record refuses the value (the adapter's modelRe), the
// pane is deliberately NOT typed into: a rejected value must not reach the agent by the back door.
//
// Only Claude Code takes `/model <id>` and `/effort <level>` as commands. Measured in the fifteenth
// cut against real panes: codex has no such command, so the typed line went to the model as a
// PROMPT; pi opens its own picker on it ("No matching models") and waits. For every other harness
// the pane half is therefore a RESTART (POST /api/slots/:id/restart), which respawns the pane from
// the record and resumes the pinned conversation. The owner is asked first (it stops running work).
const switchesInPane = (h: HarnessInfo | null): boolean => h?.id === "claude";
async function setSlotSetting(slot: number, field: "model" | "effort", value: string): Promise<string> {
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
  const paneOk = await deliver(slot, `/${field} ${value}`);
  return paneOk ? `${field} ${value} — record ✓ · pane ✓` : `record ✓ · pane ✗ — type /${field} ${value} yourself`;
}

let autosList: AutoInfo[] = [];
let tasksList: TaskInfo[] = [];
let dispatch: DispatchInfo = { available: false, on: false, maxLanes: 0, repo: "" };
// The brief compiler's runtime mode. Omitted at zero on the wire, so `undefined` and `false` mean
// the same thing here — off. A sibling `analysisOn` stood beside it until 2026-09-10 and retired
// with the queue analyst.
let briefCompilerOn: boolean | undefined;
let intakeOn = false;
// Whether THIS fleet writes the integration branch (server.ts, FLEET_LANDS). A follower instance
// fast-forwards main from the canonical host and refuses both land doors with a 409; offering ⏏
// there would be a button whose only possible outcome is an alert. Defaults to TRUE and is set from
// `data.lands !== false`, so a server that predates the field — and every ordinary canonical
// instance, which never sets the flag — keeps every land affordance exactly as it was.
let landsEnabled = true;
let serverNow = 0;
// the server's clock minus this device's, from the same poll that carries serverNow. Transcript
// timestamps are written on the server machine; a phone whose clock runs 3 min ahead would
// otherwise read every fresh turn as 3 min old (the cache counter, owner's fourteenth cut).
let serverClockSkew = 0;
let shareBase = ""; // public URL prefix for share links (FLEET_SHARE_URL server-side)

// --- transcript view model (mirrors server.ts's TEntry/TBlock) ---
interface TBlock { t: "text" | "thinking" | "tool" | "tool_result"; text: string; name?: string }
// meta = a harness-injected user turn (task-notification): shown folded, not as a "you" bubble
interface TEntry { n: number; role: "user" | "assistant"; ts: string | null; blocks: TBlock[]; meta?: boolean }

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
function entityKnown(kind: MdEntityKind, id: string): boolean {
  if (kind === "task") return tasksList.some((t) => t.id === id);
  return fleet.some((sl) => sl.id === Number(id));
}

const entTextAsked = new Set<string>();
function describeEntity(kind: string, id: string): EntFacts | null {
  const now = Date.now();
  if (kind === "task") {
    const t = tasksList.find((x) => x.id === id);
    if (!t) return null;
    const text = taskText.get(id);
    // the prompt text is not on the 2 s poll; ask the queue's own loader ONCE per id, then repaint
    const later = text === undefined && !entTextAsked.has(id)
      ? (entTextAsked.add(id), loadTaskTexts()) : undefined;
    const worker = t.slot ? fleet.find((sl) => sl.id === t.slot) : undefined;
    const workerLine = t.slot
      ? `worker: slot ${t.slot}${worker?.label ? ` · ${worker.label}` : ""}${worker?.model ? ` · ${worker.model}` : ""}`
      : "worker: —";
    return {
      meta: [`task ${t.id}`, t.status, t.kind].filter(Boolean).join(" · "),
      title: text ? qFirstLine(text) : later ? "…" : "(no text on this board)",
      lines: [
        workerLine,
        `${taskSourceLabel(t)} · filed ${fmtDur(Math.max(0, now - t.created))} ago`,
        ...(t.cluster ? [[t.cluster.projekt, t.cluster.prozess, t.cluster.unterprozess].filter(Boolean).join(" / ")] : []),
        ...(t.size ? [`size ${t.size}`] : []),
      ],
      later,
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
      ...(taskLine ? [taskLine] : []),
      ...(sl.lastOutput ? [`last output ${fmtDur(Math.max(0, now - sl.lastOutput))} ago`] : []),
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
class Pane {
  slot = 0; // 0 = unassigned
  private gen = 0; // bump to suppress a stale socket's reconnect loop
  private pinPending = false; // pin the viewport to the bottom once the next seed lands
  // which renderer this pane actually ended up on — see the block in the constructor.
  // Reported in the ⟳ tooltip because a silent one-way downgrade is otherwise invisible.
  private renderer = "dom";
  private retries = 0; // consecutive failed/flapping reconnects — indexes reconnectDelay()
  private ws: WebSocket | null = null;
  private lastCols = 0;
  private lastRows = 0;
  private resizeTimer: ReturnType<typeof setTimeout> | undefined;
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
  private view: "term" | "chat" = "term";
  private chatTotal = 0;
  // when the newest transcript entry this pane has loaded was written (its `ts`, any role — a tool
  // result or a harness-injected turn is an API round trip too), 0 until one with a time arrived.
  // The composer's cache counter reads it; nothing else does.
  lastTurnAt = 0;
  private chatSource: string | null = null;
  private chatTimer: ReturnType<typeof setTimeout> | undefined;
  private chatBusy = false;

  constructor(readonly index: number) {
    this.root = el("div", "pane");
    const termEl = el("div", "paneterm");
    this.hint = el("div", "panehint", "no session — click a slot");
    this.jump = el("button", "jump", "▼");
    this.chatEl = el("div", "panechat");
    attachEntityCards(this.chatEl, describeEntity);
    // a selection copies as the Markdown it was rendered from (src/mdcopy.ts); a selection the
    // serializer declines (nothing of ours in it) keeps the browser's own copy
    this.chatEl.addEventListener("copy", (e) => {
      const md = selectionMarkdown(this.chatEl, window.getSelection());
      if (!md || !e.clipboardData) return;
      e.clipboardData.setData("text/plain", md);
      e.preventDefault();
    });
    this.sizeBtn = el("button", "chatsizebtn", "Aa") as HTMLButtonElement;
    this.sizeBtn.title = "Schriftgröße — Text, Code, Oberfläche (Strg/⌘ + / − / 0)";
    this.sizeBtn.onclick = (e) => {
      e.stopPropagation();
      const panel = sizePanel();
      if (panel.parentElement === this.root && panel.classList.contains("open")) {
        panel.classList.remove("open");
        return;
      }
      this.root.appendChild(panel);
      panel.classList.add("open");
    };
    this.viewBtn = el("button", "viewtoggle", "💬") as HTMLButtonElement;
    this.viewBtn.title = "toggle conversation view";
    this.viewBtn.style.display = "none";
    this.viewBtn.onclick = (e) => {
      e.stopPropagation();
      this.setView(this.view === "term" ? "chat" : "term");
    };
    // board toggle sits beside the viewtoggle; the board always describes the
    // FOCUSED session, and clicking a pane focuses it first (root mousedown)
    this.boardBtn = el("button", "boardtoggle", "ℹ") as HTMLButtonElement;
    this.boardBtn.title = "session brief — commits, changes, prompts, 📋 summary";
    this.boardBtn.style.display = "none";
    this.boardBtn.classList.toggle("active", boardOpen);
    this.boardBtn.onclick = (e) => {
      e.stopPropagation();
      focusPane(this.index);
      setBoard(!boardOpen);
    };
    // reload sits left of the ℹ/💬 cluster — forces THIS pane to reconnect + reseed
    // scrollback (moved here from the sidebar so it acts on the pane you're looking at)
    this.reloadBtn = el("button", "panereload", "↻") as HTMLButtonElement;
    this.reloadBtn.title = "reload this session (reconnect + reseed scrollback)";
    this.reloadBtn.style.display = "none";
    this.reloadBtn.onclick = (e) => { e.stopPropagation(); this.reconnect(); };
    const navUp = el("button", "promptnav up", "↑") as HTMLButtonElement;
    navUp.title = "previous prompt of yours";
    navUp.onclick = (e) => { e.stopPropagation(); this.jumpPrompt(-1); };
    const navDn = el("button", "promptnav dn", "↓") as HTMLButtonElement;
    navDn.title = "next prompt of yours";
    navDn.onclick = (e) => { e.stopPropagation(); this.jumpPrompt(1); };
    this.root.append(termEl, this.flakes.canvas, this.chatEl, this.hint, this.jump, this.sizeBtn,
      this.viewBtn, this.boardBtn, this.reloadBtn, navUp, navDn);
    this.term = new Terminal({
      // 10k, not the 50k this carried from the first commit (f43e3fb1) without ever being
      // revisited. The number is a PER-PANE cost and the board shows several at once, so a
      // six-pane layout was holding 300 000 lines of buffer in one tab — memory xterm walks
      // on every viewport calculation, which is what scrolling one of them costs. Nothing is
      // actually lost: the server only ever seeds SEED_LINES (3000) on connect, tmux keeps the
      // real history, and ⟳ reload re-seeds from it. 10k is still three seeds deep.
      scrollback: 10000,
      // Owner-Meldung 2026-09-11: "es stottert doch immernoch pro Zeile". Das war keine
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
    });
    this.fit = new FitAddon();
    this.term.loadAddon(this.fit);
    this.term.open(termEl);
    // GPU renderers instead of the default DOM one (which paints every cell as a real DOM
    // node — scroll stutter on mobile Safari under streaming output). WebGL is the fastest
    // and crispest; it can fail (no context on old GPUs, context loss later) — fall back to
    // the canvas renderer either way. Addons are disposed by term.dispose().
    //
    // WHY THIS IS WORTH SEEING (owner report 2026-09-11: "es wechselt irgendwie immer
    // zwischen diesen beiden Zuständen" — scrolling is clean, then it stutters, then it is
    // clean again after a reload). The fallback below is SILENT and ONE-WAY: once a pane's
    // WebGL context is lost it runs on canvas for the rest of that page load, and nothing
    // anywhere says so. Two panes side by side can therefore sit on different renderers,
    // and the same pane can feel different before and after a reload — with no visible
    // cause. A context is lost for reasons that have nothing to do with Fleet (GPU driver
    // reset, the tab being backgrounded, the browser reclaiming contexts under memory
    // pressure) and also for one that does: setLayout() disposes every pane and builds n
    // new ones, so each layout switch returns n contexts and immediately asks for n more,
    // and browsers release them lazily.
    //
    // So the renderer is RECORDED and shown in the ⟳ button's tooltip. It is deliberately
    // only a report: nothing here re-acquires WebGL, because a retry that keeps failing
    // would thrash the very thing it is trying to fix, and the decision of whether to
    // retry needs this number from a real session first. If a stuttering pane says
    // "canvas" and a smooth one says "webgl", the mechanism above is confirmed and the
    // fix belongs in the renderer policy (e.g. WebGL only for the focused pane). If BOTH
    // say "webgl", the stutter is not the renderer and this comment saved the next reader
    // the same detour.
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => {
        webgl.dispose();
        this.term.loadAddon(new CanvasAddon());
        this.renderer = "canvas (WebGL-Kontext verloren)";
        this.markRenderer();
        console.warn(`[fleet] slot ${this.slot}: WebGL context lost — pane fell back to canvas for the rest of this page load`);
      });
      this.term.loadAddon(webgl);
      this.renderer = "webgl";
    } catch {
      this.term.loadAddon(new CanvasAddon());
      this.renderer = "canvas (kein WebGL)";
    }
    this.markRenderer();
    // on touch devices all input goes through the compose bar + key row; inputMode=none
    // lets xterm keep focus for scrolling without popping the on-screen keyboard
    if (isMobile() && this.term.textarea) this.term.textarea.inputMode = "none";
    this.term.onData((d) => this.sendRaw(d));
    this.term.attachCustomKeyEventHandler((e) => {
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
    this.jump.onclick = () => { this.term.scrollToBottom(); this.focus(); };
    this.root.addEventListener("mousedown", () => focusPane(this.index));
    this.root.addEventListener("animationend", () => this.root.classList.remove("flash"));
  }

  // briefly rings the pane in the focus-blue accent — desktop only (mobile only ever
  // shows one pane, so there's no "which one changed" ambiguity to clear up)
  flash() {
    if (isMobile()) return;
    this.root.classList.remove("flash");
    void this.root.offsetWidth; // force reflow so re-adding the class retriggers the CSS animation
    this.root.classList.add("flash");
  }

  private copySelection() {
    copyText(this.term.getSelection());
  }

  // NOTE: in-terminal sent-prompt markers (xterm decorations anchored at the send line)
  // were built and tested against a real claude TUI — its full-repaint behavior plus our
  // own resize jiggle relocates content, so line-anchored marks drift and were dropped.
  // "What did I send" lives in the 🕘 prompt history and the conversation view instead.

  setView(v: "term" | "chat") {
    this.view = v;
    this.root.classList.toggle("chat", v === "chat");
    this.viewBtn.textContent = v === "chat" ? "⌨" : "💬";
    this.viewBtn.title = v === "chat" ? "back to terminal" : "toggle conversation view";
    this.flakes.setActive(v === "chat");
    if (v !== "chat") sizePanel().classList.remove("open");
    this.syncHarnessAffordances();
    mountComposer(); // the one composer takes the size of the focused pane's view
    clearTimeout(this.chatTimer);
    if (v === "chat") void this.pollChat();
    else this.term.focus();
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
    const canChat = !this.slot || supportsOf(fleet.find((x) => x.id === this.slot)?.harness).transcript;
    this.viewBtn.style.display = this.slot && canChat ? "block" : "none";
    if (focused === this.index) renderComposerOpts(false);
    // a pane already sitting in the chat view must not be stranded there when its slot turns out
    // to have no transcript behind it
    if (this.slot && !canChat && this.view === "chat") this.setView("term");
  }

  private resetChat() {
    clearTimeout(this.chatTimer);
    this.chatEl.replaceChildren();
    this.chatTotal = 0;
    this.lastTurnAt = 0;
    this.chatSource = null;
    this.toolGroup = null;
    this.notifGroup = null;
    // un-stick the busy flag so the reassigned pane's next pollChat() isn't blocked; the
    // old slot's in-flight fetch bails on the slot-identity guard in pollChat.
    this.chatBusy = false;
  }

  // --- conversation rendering: the view exists so YOUR messages are findable.
  // They render as prominent anchors; everything the agent did between two texts
  // collapses into one expandable "⚙ n steps" line instead of a wall of rows. ---
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
    this.chatEl.appendChild(det);
    this.toolGroup = { det, sum, body, count: 0, lastStep: null };
    return this.toolGroup;
  }

  private addStep(b: TBlock) {
    const g = this.ensureToolGroup();
    if (b.t === "tool_result" && g.lastStep) {
      // attach the result to the call it answers instead of its own row
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
      g.body.appendChild(step);
      g.count++;
      g.lastStep = b.t === "tool" ? step : null;
    }
    g.sum.textContent = `⚙ ${g.count} step${g.count === 1 ? "" : "s"}`;
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
      this.chatEl.appendChild(det);
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

  // One message: the rendered body (a bubble for you, free prose for the agent — t3code's layout
  // grammar) and a meta row that appears on hover with the time and a copy of the SOURCE text.
  private appendEntry(e: TEntry) {
    if (e.meta) { this.addNotif(e); return; }
    this.notifGroup = null; // a real entry ends the notification run
    for (const b of e.blocks) {
      if (b.t === "text") {
        this.toolGroup = null; // a message ends the current work block
        const text = e.role === "user" ? unwrapPasted(b.text) : b.text;
        const msg = el("div", `msg ${e.role}`);
        const body = el("div", "mbody");
        mdInto(body, text, { entity: entityKnown });
        for (const code of body.querySelectorAll<HTMLElement>(".code")) decorateCode(code);
        const meta = el("div", "mmeta");
        const who = e.role === "user" ? "you" : "claude";
        meta.appendChild(el("span", "mwho", e.ts ? `${who} · ${fmtClock(e.ts)}` : who));
        meta.appendChild(copyButton("copy", "copy this message as Markdown", () => text));
        msg.append(body, meta);
        this.chatEl.appendChild(msg);
      } else {
        this.addStep(b);
      }
    }
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
    const slot = this.slot;
    this.chatBusy = true;
    try {
      const res = await api(`/api/slots/${slot}/transcript?after=${this.chatTotal}`);
      if (this.slot !== slot) return; // reassigned during the fetch — this response is stale
      if (!res.ok) return;
      const data = (await res.json()) as { entries: TEntry[]; total: number; source: string | null };
      if (this.slot !== slot) return; // reassigned during json() — still stale
      // the slot's active transcript changed (fresh claude after a self-heal, or a better
      // pinned file appeared) — start over from the top of the new file
      if (this.chatSource !== null && data.source !== this.chatSource) {
        this.chatEl.replaceChildren();
        this.chatTotal = 0;
        this.chatSource = data.source;
        return; // next tick refills from 0
      }
      this.chatSource = data.source;
      if (data.source === null && !this.chatEl.childElementCount) {
        this.chatEl.replaceChildren(el("div", "chatempty", "no transcript yet — say something in the terminal"));
      }
      if (data.entries.length) {
        const empty = this.chatEl.querySelector(".chatempty");
        if (empty) empty.remove();
        // keep the view pinned to the newest message unless the user scrolled up to read
        const pinned = this.chatEl.scrollTop + this.chatEl.clientHeight >= this.chatEl.scrollHeight - 120;
        for (const e of data.entries) {
          this.appendEntry(e);
          // the cache counter's reference is the last API REQUEST, and a request starts right
          // after a prompt (a user entry) or a tool result — the agent's own text and tool calls
          // are the response to it, not a new read of the cache (fifteenth cut, measured: counting
          // every entry reset the counter up to 3× per tool turn)
          const startsRequest = e.role === "user" || e.blocks.some((b) => b.t === "tool_result");
          const at = startsRequest && e.ts ? Date.parse(e.ts) : NaN;
          if (at > this.lastTurnAt) this.lastTurnAt = at;
        }
        tickCacheAge();
        if (pinned) this.chatEl.scrollTop = this.chatEl.scrollHeight;
      }
      this.chatTotal = data.total;
    } catch {
      // transient fetch error — next tick retries
    } finally {
      // only the poll that still owns the current slot manages busy/timer state; a stale
      // (reassigned) poll must not reset the new slot's chatBusy or reschedule its timer.
      if (this.slot === slot) {
        this.chatBusy = false;
        // chatMs === 0 means the tab went hidden mid-fetch: stop the chain rather than
        // re-arm it. chatPump() (driven by the poll pump on the way back) restarts it.
        const ms = plan().chatMs;
        if (this.view === "chat" && ms) {
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
    if (this.ws?.readyState !== WebSocket.OPEN) return;
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
    ws.onopen = () => {
      openedAt = Date.now();
      if (focused === this.index) setConn(true);
      this.sendResize(true);
    };
    ws.onmessage = (e) => {
      // the seed (a scrollback capture, on every path) is always the first frame the
      // server sends on open. Once it's parsed, the buffer sits at ydisp===ybase, but
      // xterm's DOM viewport can be parked at row 0 — its Viewport refresh multiplies
      // ydisp by a rowHeight that is 0 until the pane element is measured/visible, so a
      // refresh that lands a frame too early leaves scrollTop=0 ("stuck at the top").
      // Re-pin once the seed is written; the write callback runs after the buffer settles.
      const pin = this.pinPending;
      this.pinPending = false;
      this.term.write(new Uint8Array(e.data as ArrayBuffer), pin ? () => this.pinToBottom() : undefined);
    };
    ws.onclose = () => {
      if (g !== this.gen) return; // superseded by a reassign or dispose
      if (focused === this.index) setConn(false);
      // every successful open costs a scrollback seed, so a socket that keeps opening and
      // dropping is as expensive as one that never opens — only a socket that STAYED up
      // earns the fast first retry back (see src/backoff.ts)
      if (openedAt && Date.now() - openedAt >= RECONNECT_SETTLED_MS) this.retries = 0;
      const wait = reconnectDelay(this.retries++);
      setTimeout(() => {
        if (g === this.gen && fleet[this.slot - 1]?.cwd) this.connect();
      }, wait);
    };
  }

  assign(slot: number) {
    if (slot === this.slot) { this.focus(); return; }
    this.slot = slot;
    this.retries = 0; // a different pane: the old one's backoff says nothing about this one
    this.gen++; // orphan the old socket before close so its onclose can't reconnect
    this.ws?.close();
    this.term.reset();
    this.resetChat();
    this.boardBtn.style.display = slot ? "block" : "none";
    this.reloadBtn.style.display = slot ? "block" : "none";
    this.syncHarnessAffordances();
    if (slot && this.view === "chat") void this.pollChat();
    this.hint.style.display = slot ? "none" : "flex";
    // size the terminal to its container before connecting — the WS URL carries
    // this size, and connecting at a stale default (e.g. 80x24) would seed scrollback
    // at the wrong width and force an immediate second reseed once refit() catches up
    if (slot) { this.fit.fit(); this.pinPending = true; this.connect(); }
    this.focus();
    renderSlots(); // focusPane skips no-op renders, but an assignment always changes the sidebar
    saveView();
  }

  focus() {
    focusPane(this.index);
    if (!isMobile()) this.term.focus(); // focusing would be pointless without a hardware keyboard
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
    this.term.reset();
    this.fit.fit();
    this.pinPending = true;
    this.connect(true);
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
      if (b.viewportY !== b.baseY) { this.term.scrollToBottom(); return; }
      this.term.scrollLines(-1);
      this.term.scrollToBottom();
    });
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
    this.resizeTimer = setTimeout(() => this.sendResize(), 500);
  }

  private sendResize(force = false) {
    if (!this.slot) return;
    if (!force && this.term.cols === this.lastCols && this.term.rows === this.lastRows) return;
    this.lastCols = this.term.cols;
    this.lastRows = this.term.rows;
    void post("/resize", { slot: this.slot, cols: this.term.cols, rows: this.term.rows });
  }

  // the ⟳ tooltip is the only place a pane's renderer is visible, and ⟳ is also the button
  // that fixes a degraded one (reload rebuilds the Terminal and asks for a fresh context)
  private markRenderer() {
    this.reloadBtn.title = `reload this session (reconnect + reseed scrollback)\nrenderer: ${this.renderer}`;
  }

  dispose() {
    this.gen++;
    this.ws?.close();
    clearTimeout(this.resizeTimer);
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

let panes: Pane[] = [];
let focused = 0;
let layout = 1;

// --- right sideboard: session brief (desktop-only). Deterministic layers only —
// git facts fetched fresh from /brief per render, and the prompt outline derived from
// the SAME transcript feed the conversation view renders. No state of its own to drift.
interface BriefCommit { hash: string; ts: number; subject: string }
interface BriefInfo { branch: string | null; head: string | null; worktree: WorktreeInfo | null;
  sessionStart: number | null;
  uncommitted: number; uncommittedFiles: string[]; files: string[]; shortstat: string;
  commits: BriefCommit[]; repoCommits: BriefCommit[]; laneScoped: boolean; laneBase: string | null;
  ahead: number; behind: number; gitOp?: boolean }
// Which repo string the REPO-WIDE routes will accept for this slot. `/api/commits` validates its
// `repo` against knownRepos() (server.ts) — which holds a lane's PARENT repo and a plain session's
// own cwd, never a lane's worktree path. Measured 2026-08-20: for a lane, `worktree.repo` is in
// that list; for a plain repo session, `cwd` is. `repo` (the canonical toplevel) is deliberately
// NOT preferred — a session opened in a SUBDIRECTORY has a toplevel that knownRepos never added,
// and the lens says so honestly rather than this guessing a third spelling.
const repoOfSlot = (s: SlotInfo | undefined, brief: BriefInfo): string | null =>
  brief.worktree?.repo ?? s?.cwd ?? null;

const boardBody = $("boardbody");
let boardOpen = localStorage.getItem("fleet.board") === "1";
let boardBusy = false;
// the AGENTS group sits behind a "more ▸" disclosure, folded away by default (owner call
// 2026-08-06): the advisory summary/review are the least-used part of the board and were
// pushing the git story down. Deliberately NOT persisted — "folded by default" means every
// page load starts folded — but it IS module state, so the board's 3s re-render cannot
// snap it shut while you are reading a finding.
let agentsOpen = false;
// per-slot outline cursor, incremental like pollChat: full fetch once, then only new entries
const outline = new Map<number, { total: number; source: string | null; prompts: string[] }>();
// ✨ agent summary (BACKLOG #14 Phase 2): result of the server's short-lived
// claude -p run, cached per slot. Only ever fetched via GET (cache lookup) on
// first view — the model call itself is strictly click-triggered (POST).
interface SummaryInfo { summary?: string; openThreads?: string[]; verification?: string;
  model?: string; at?: number; head?: string | null; dirty?: number; error?: string }
const sumCache = new Map<number, SummaryInfo>();
const sumBusy = new Set<number>();
// 🔍 agent review: the same click-only contract as the summary, over this slot's own code
// changes. Owner-only (no share counterpart) and purely advisory — nothing here gates a land.
interface ReviewFinding { title: string; file: string; line: number | null;
  impact: "high" | "medium" | "low"; cost: string; basis: "verified" | "inferred"; detail: string }
interface ReviewInfo { findings?: ReviewFinding[]; scope?: string; notes?: string;
  model?: string; at?: number; head?: string | null; dirty?: number; error?: string;
  // content identity of the reviewed diff — the disposition rail's join key for a review label
  // (null = not computable, and then the review is deliberately not labelable)
  patchId?: string | null }
const revCache = new Map<number, ReviewInfo>();
const revBusy = new Set<number>();
// lane map + ⏫ merge agent (async job on the server; the board's 3s poll carries state)
interface WtRisk { dirtyFiles: string[]; unpushedCommits: { hash: string; subject: string }[];
  shortstat: string | null; empty: boolean }
interface WtRow extends WtRisk { path: string; branch: string; slot: number | null; dirty: number; ahead: number; behind: number; note?: string | null }
interface WtInfo { repo: string; main: string; worktrees: WtRow[] }
// 💾 lane commit in flight, per slot — carries the MODE so the button can label itself
// ("… saving" vs "… writing message") while the request runs.
const commitBusy = new Map<number, "quick" | "agent">();
// the server's deterministic verify verdict against the rebased tree (mirrors server.ts
// `interface MergeLast`'s `verify`). Absent = "unverified" (no FLEET_VERIFY_CMD result on
// record); `ok: null` = nothing was measured — the command DECLINED (skipped), or `timedOut`
// says our own clock killed it. Neither absence nor either non-measurement may render as green. `stale` is set at confirm-land when main moved
// past the `mainSha` the verify ran against (the verdict is void once main moves past it).
// mirrors MergeLast["verify"] in server.ts — `ok:null` is "nothing was measured", and the two kill
// flags split that three ways: the command declining (SKIPPED), our clock killing it while it
// worked (TIMED OUT), and our clock killing it while it was still queued behind the suite mutex
// (NEVER STARTED — it never looked at the tree). The timing fields are optional on both sides: a
// record deserialized from an older server has none.
type VerifyVerdict = { cmd: string; ok: boolean | null; out: string; at: number; mainSha: string; stale?: boolean;
  timedOut?: true; waitedOut?: true; serverDown?: true; startedAt?: number; ms?: number; waitMs?: number; waitPartial?: true;
  exitCode?: number | null };
interface MergeState { running: boolean;
  // "interrupted" is the durable marker a merge run leaves about itself before it starts: a run
  // that never came back (the server was killed mid-job) is reported as such instead of as no
  // verdict at all. Rendered by the plain verdict note below, like every other non-resolved state.
  // "awaiting-author" (②) means the conflict was handed to the lane's OWN session rather than to a
  // throwaway resolver. Deliberately NOT part of `awaitingReview` below: nothing is in the tree to
  // review yet — the author is still working, and the next ⏫ is what brings the resolution back.
  last: { status: "merged" | "blocked" | "error" | "resolved" | "interrupted" | "awaiting-author"; detail: string; landed: boolean;
    branch: string; at: number; conflicted?: string[]; verify?: VerifyVerdict; resolvedBy?: "agent" | "author" } | null;
  // WHAT `last` IS, said by the route instead of inferred from the pair (server.ts, the ⏫ GET arm):
  // "verdict" settled · "intent" the running job's own marker, nothing wrong · "interrupted" a
  // marker no running job owns, i.e. the real mid-run death · null no row. Optional here because an
  // older server answers this route without it, and absent must not read as any of the four.
  lastIs?: "verdict" | "intent" | "interrupted" | null;
  // …and WHO the answer is about. A slot is a reusable seat, so the lane that was asked about and
  // the lane the answer describes are not the same question. Optional for the same reason.
  lane?: { repo: string; branch: string };
  // the repo's most recent still-undoable land (null if none) — drives the ↩ undo button
  undoable?: { branch: string; at: number } | null }
// slots with a merge job the client kicked off or observed — when such a slot goes
// inactive (job landed the lane), its panes must be released like a manual ⏏ does
const mergeWatch = new Set<number>();

// synchronous in-flight guards: the server serializes too, but a double-click must not
// even fire the second request (the response to it would just say "running"/"reserved")
const mergePending = new Set<number>();
let laneReqBusy = false;
// ☠ discard confirm state — module-level because the board fully re-renders on a 3s poll:
// the panel (and its read-first countdown) must survive re-renders, so each render derives
// it from here instead of holding DOM state. `at` anchors the 4s gate to the FIRST click.
let discardArm: { path: string; at: number } | null = null;
const DISCARD_READ_MS = 4000;
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && discardArm) { discardArm = null; void renderBoard(); }
});

// shared risk-preview panel: shows the ACTUAL file names / commit subjects a destructive
// action is about to touch, before the click — not only after a refusal (the server always
// re-verifies via worktreeRisk regardless of what this shows; this is purely informational).
function showRiskPreview(title: string, risk: WtRisk, confirmLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = el("div", "overlay riskoverlay");
    overlay.style.display = "flex";
    const panel = el("div", "panel riskpanel");
    panel.appendChild(el("h2", "", title));
    if (risk.empty) {
      panel.appendChild(el("div", "riskempty", "safe — no uncommitted changes, no unpushed commits"));
    } else {
      if (risk.dirtyFiles.length) {
        panel.appendChild(el("div", "riskhead",
          `${risk.dirtyFiles.length} uncommitted file${risk.dirtyFiles.length === 1 ? "" : "s"}`));
        const list = el("div", "risklist");
        for (const f of risk.dirtyFiles.slice(0, 40)) list.appendChild(el("div", "riskfile", f));
        if (risk.dirtyFiles.length > 40) list.appendChild(el("div", "riskmore", `… ${risk.dirtyFiles.length - 40} more`));
        panel.appendChild(list);
      }
      if (risk.unpushedCommits.length) {
        panel.appendChild(el("div", "riskhead",
          `${risk.unpushedCommits.length} unpushed commit${risk.unpushedCommits.length === 1 ? "" : "s"}`));
        const list = el("div", "risklist");
        for (const c of risk.unpushedCommits.slice(0, 40)) list.appendChild(el("div", "riskcommit", `${c.hash} ${c.subject}`));
        panel.appendChild(list);
      }
    }
    const btns = el("div", "riskbtns");
    const cancel = el("button", "riskbtn", "cancel") as HTMLButtonElement;
    const go = el("button", "riskbtn danger", confirmLabel) as HTMLButtonElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); finish(false); }
    };
    const finish = (ok: boolean) => { document.removeEventListener("keydown", onKey, true); overlay.remove(); resolve(ok); };
    // capture-phase so Escape closes THIS overlay before the global discardArm handler sees it
    document.addEventListener("keydown", onKey, true);
    cancel.onclick = () => finish(false);
    go.onclick = () => finish(true);
    overlay.onclick = (e) => { if (e.target === overlay) finish(false); };
    btns.append(cancel, go);
    panel.appendChild(btns);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  });
}
// fail CLOSED: if the risk fetch itself fails, never claim "empty/safe" — show it as a
// single unverifiable "file" so the preview still reads as "don't assume, go check"
const UNKNOWN_RISK: WtRisk = { dirtyFiles: ["(could not verify — check manually before proceeding)"], unpushedCommits: [], shortstat: null, empty: false };
async function fetchSlotRisk(slotId: number): Promise<WtRisk> {
  try {
    const r = await api(`/api/slots/${slotId}/risk`);
    if (!r.ok) return UNKNOWN_RISK;
    return (await r.json()) as WtRisk;
  } catch {
    return UNKNOWN_RISK;
  }
}

// unified land action — the row used to offer three glyphs for this (⏫ agent merge&land,
// ⏏ plain land, ⏬ confirm-land-after-review) that were really the same intent seen from
// three server paths. One click, one confirm, backed by the real risk preview (not just
// text): try the fast direct path first (lane already clean & pushed/merged — /land removes
// the worktree with no agent involved), and only fall through to the merge agent (/merge —
// rebases onto main, resolves conflicts if any, then either lands automatically or pauses
// for review) when the fast path refuses. Server-side semantics of both endpoints are
// untouched; this only decides which one the UI calls first.
async function doLand(slot: number) {
  if (mergePending.has(slot)) return;
  const s = fleet[slot - 1];
  if (!s?.worktree) return;
  mergePending.add(slot); // reserve BEFORE the preview await, else a double-click opens two overlays
  try {
    // one-gesture land: a dirty tree is committed FIRST (reusing the 💾 commit machinery — the
    // same local, never-pushed, reversible commit), then landed. The owner no longer pre-commits.
    // Unpushed commits are the land's payload, not a risk — shown in the diff review below.
    const risk = await fetchSlotRisk(slot);
    if (risk.dirtyFiles.length) {
      const ok = await showRiskPreview(`Land lane ${s.worktree.branch}? — your uncommitted work is committed first, then landed`, risk, "commit + land");
      if (!ok) return;
      // `confirm`: the preview above IS the acknowledgement the route's idle gate asks for (it
      // says, in as many words, that the uncommitted work is committed first) — same reasoning as
      // doCommit's activeConfirmed. Without it a land on a lane that is still producing output
      // bounces off the gate with a 409 whose body carries no `error`, i.e. the alert below reads
      // "could not commit the work first: undefined" for a tree that is perfectly fine.
      const cr = await post(`/api/slots/${slot}/commit`, { mode: "agent", confirm: true });
      const cj = (await cr.json().catch(() => ({}))) as { committed?: boolean; reason?: string; error?: string };
      if (!cr.ok) { alert(`Land failed — could not commit the work first: ${cj.error ?? cr.status}`); return; }
      // commit refused for an UNSAFE tree (a half-finished git op, or a detached HEAD) → never
      // finalize that into a land. A benign "nothing to commit" (a race) falls through to land.
      if (!cj.committed && /in progress|detached/i.test(cj.reason ?? "")) { alert(`Cannot land: ${cj.reason}`); return; }
    }
    // always review the diff that will land, even on a clean auto-land (the old blind spot).
    // surface the deterministic verify verdict (if the server has one for THIS branch) so a
    // red/stale tree is flagged before the glance-approval — informs, never disables (F-A.3).
    const mgv = await api(`/api/slots/${slot}/merge`)
      .then(async (r) => (r.ok ? ((await r.json()) as MergeState) : null))
      .catch(() => null);
    const verify = mgv && !mgv.running && mgv.last && mgv.last.branch === s.worktree.branch
      ? mgv.last.verify : undefined;
    const proceed = await showLandReview(`Land ${s.worktree.branch} → main — review what lands`, slot, verify);
    if (!proceed) return;
    const direct = await post(`/api/slots/${slot}/land`, {});
    if (direct.ok) {
      for (const p of panes) if (p.slot === slot) p.assign(0);
      await refresh();
      return;
    }
    const r = await post(`/api/slots/${slot}/merge`, {});
    const j = (await r.json().catch(() => ({}))) as
      { running?: boolean; status?: string; landed?: boolean; detail?: string; error?: string };
    if (!r.ok) { alert(`Land failed: ${j.error ?? r.status}`); return; }
    if (j.running) { mergeWatch.add(slot); return; }
    // immediate verdicts (dirty lane/primary, already-merged) come back synchronously
    if (j.status === "blocked") alert(`Land blocked: ${j.detail ?? ""}`);
    else if (j.status === "merged" && j.landed) {
      for (const p of panes) if (p.slot === slot) p.assign(0);
      await refresh();
    }
  } catch {
    alert("Land failed — network error");
  } finally {
    mergePending.delete(slot);
    void renderBoard();
  }
}

// confirm-land after reviewing an agent conflict resolution: the server ff-merges the
// already-rebased lane onto main and lands — no agent, purely git-verified
async function doMergeLand(slot: number) {
  if (mergePending.has(slot)) return;
  mergePending.add(slot);
  try {
    const r = await post(`/api/slots/${slot}/merge`, { confirm: true });
    const j = (await r.json().catch(() => ({}))) as
      { status?: string; landed?: boolean; detail?: string; error?: string };
    if (!r.ok) { alert(`Land failed: ${j.error ?? r.status}`); return; }
    if (j.status === "merged" && j.landed) {
      for (const p of panes) if (p.slot === slot) p.assign(0);
      await refresh();
    } else if (j.status === "blocked" || j.status === "error") {
      alert(`Not landed: ${j.detail ?? j.status}`);
    }
  } catch {
    alert("Land failed — network error");
  } finally {
    mergePending.delete(slot);
    void renderBoard();
  }
}

// ⇲ shelve — set a lane aside WITH a note ("what's left"), instead of landing it. The server
// records the note (keyed by worktree path) and kills the slot; the worktree stays on disk as an
// orphan, now resumable WITH context. The safe third exit beside land — no work lost, no
// destruction. The note shows on the lanes list and clears when the lane is reopened.
async function doShelve(slot: number) {
  const s = fleet[slot - 1];
  if (!s?.worktree) return;
  const note = prompt("Shelve this lane — what's left to do? (shown when you resume it)");
  if (note === null) return; // cancelled
  const r = await post(`/api/slots/${slot}/shelve`, { note });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    alert(j.error ?? "shelve failed");
    return;
  }
  for (const p of panes) if (p.slot === slot) p.assign(0);
  await refresh();
}

// ↩ undo the last land on a repo — reset main back to where THAT land found it. One press
// reverses one land off the top of the server's capped undo stack; press again for the one
// below it. The server decides with git (only if main hasn't moved since and no commit of the
// land is on a remote) and refuses safely otherwise. The landed branch survives, so the work is
// recoverable either way.
async function doUndoLand(repo: string, branch: string): Promise<void> {
  if (!confirm(`Undo the last land (${branch}) — reset main back to before it? The '${branch}' branch is kept, so the work stays recoverable.`)) return;
  const r = await post("/api/repos/undo-land", { repo });
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; note?: string; error?: string };
  if (!r.ok) { alert(j.error ?? "undo failed"); await refresh(); return; }
  alert(j.note ?? "main reset to before the last land");
  await refresh();
}

// 💾 save a lane's uncommitted work — the gap land/merge (dirty-tree refusers) leave open.
// quick = deterministic wip commit; agent = a short-lived agent writes a conventional-commit
// message (falls back to wip). Commit-only, reversible; the server never pushes or lands.
async function doCommit(slot: number, mode: "quick" | "agent", activeConfirmed = false): Promise<void> {
  if (commitBusy.has(slot)) return;
  // reserve synchronously BEFORE the confirmMidRun await (mirrors doLand's mergePending
  // fix) — else two near-simultaneous triggers both pass the has() check and double-commit.
  commitBusy.set(slot, mode);
  void renderBoard(); // reflect the disabled/"… writing message" state immediately
  try {
    // the session is still producing output → confirm before snapshotting a half-finished tree.
    // main sessions already warn inside their staging preview, so they pass activeConfirmed.
    const wasActive = sessionActive(slot);
    if (!activeConfirmed && wasActive && !(await confirmMidRun(slot))) return;
    // the server runs the same idle gate now (it is no longer client-only theater), so tell it
    // the warning was already acknowledged — otherwise a confirmed mid-run commit bounces off it.
    const r = await post(`/api/slots/${slot}/commit`, { mode, confirm: activeConfirmed || wasActive });
    const j = (await r.json().catch(() => ({}))) as
      { committed?: boolean; hash?: string; subject?: string; reason?: string; error?: string;
        messageFallback?: boolean };
    if (!r.ok && !j.reason) alert(`Commit failed: ${j.error ?? r.status}`);
    // the save succeeded but the model half of it did not — say so instead of passing off a
    // wip message as the agent's work (the button promised one).
    else if (j.committed) alert(`committed ${j.hash} — ${j.subject}`
      + (j.messageFallback ? "\n\nagent message unavailable — saved as wip" : ""));
    else alert(j.reason ?? "nothing to commit");
  } catch {
    alert("Commit failed — network error");
  } finally {
    commitBusy.delete(slot);
    await refresh();
    void renderBoard();
  }
}

// "working" = the pane produced real output within RECENT_MS — the same signal as the sidebar
// activity dot. For Claude Code this tracks the working spinner, so it reads true while the agent
// runs and false once it's back at the prompt. It's a heuristic (a silently-running command reads
// idle; a just-finished run reads active for a few seconds), so it GATES WITH A CONFIRM, never a
// hard block — and a commit is reversible anyway.
function sessionActive(slot: number): boolean {
  const s = fleet[slot - 1];
  return !!s && s.cwd !== null && serverNow - s.lastOutput < RECENT_MS;
}

// mid-run guard for the commit action: the session is producing output, so a commit now would
// snapshot a half-finished tree. Confirm, don't forbid — sometimes you DO want to save before
// killing a stuck run.
function confirmMidRun(slot: number): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = el("div", "overlay riskoverlay");
    overlay.style.display = "flex";
    const panel = el("div", "panel riskpanel");
    panel.appendChild(el("h2", "", `Slot ${slot} is still working`));
    panel.appendChild(el("div", "bmidrun",
      "This session produced output a moment ago — it may be mid-edit. Committing now snapshots a half-finished "
      + "tree, and an agent message would describe that partial state. It's reversible (git reset), but usually "
      + "you want to let the run finish first."));
    const btns = el("div", "riskbtns");
    const cancel = el("button", "riskbtn", "wait") as HTMLButtonElement;
    const go = el("button", "riskbtn danger", "commit anyway") as HTMLButtonElement;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); finish(false); } };
    const finish = (ok: boolean) => { document.removeEventListener("keydown", onKey, true); overlay.remove(); resolve(ok); };
    document.addEventListener("keydown", onKey, true);
    cancel.onclick = () => finish(false);
    go.onclick = () => finish(true);
    overlay.onclick = (e) => { if (e.target === overlay) finish(false); };
    btns.append(cancel, go);
    panel.appendChild(btns);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  });
}

// commit for a MAIN (non-lane) session: preview exactly what `git add -u` will stage
// (tracked changes) and which untracked files are left alone, THEN commit. The server
// re-derives everything; this preview is the guardrail that makes a commit onto a shipped
// branch as transparent as a lane commit onto a throwaway one.
function showCommitPreview(title: string, tracked: string[], untracked: string[], active: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = el("div", "overlay riskoverlay");
    overlay.style.display = "flex";
    const panel = el("div", "panel riskpanel");
    panel.appendChild(el("h2", "", title));
    if (active) panel.appendChild(el("div", "bmidrun",
      "⚠ this session is still working — you may be committing a half-finished snapshot."));
    panel.appendChild(el("div", "riskhead", `${tracked.length} tracked file${tracked.length === 1 ? "" : "s"} → committed (git add -u)`));
    const tl = el("div", "risklist");
    for (const f of tracked.slice(0, 40)) tl.appendChild(el("div", "riskfile", f));
    if (tracked.length > 40) tl.appendChild(el("div", "riskmore", `… ${tracked.length - 40} more`));
    panel.appendChild(tl);
    if (untracked.length) {
      panel.appendChild(el("div", "riskhead skip", `${untracked.length} untracked file${untracked.length === 1 ? "" : "s"} → left alone`));
      const ul = el("div", "risklist");
      for (const f of untracked.slice(0, 20)) ul.appendChild(el("div", "riskfile skip", f.slice(3)));
      if (untracked.length > 20) ul.appendChild(el("div", "riskmore", `… ${untracked.length - 20} more`));
      panel.appendChild(ul);
    }
    const btns = el("div", "riskbtns");
    const cancel = el("button", "riskbtn", "cancel") as HTMLButtonElement;
    const go = el("button", "riskbtn", "commit") as HTMLButtonElement; // reversible → not styled destructive
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); finish(false); } };
    const finish = (ok: boolean) => { document.removeEventListener("keydown", onKey, true); overlay.remove(); resolve(ok); };
    document.addEventListener("keydown", onKey, true);
    cancel.onclick = () => finish(false);
    go.onclick = () => finish(true);
    overlay.onclick = (e) => { if (e.target === overlay) finish(false); };
    btns.append(cancel, go);
    panel.appendChild(btns);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  });
}

// " (ran 362s, 255s of it queued behind the suite mutex)" — empty when the record predates the
// timing fields. The wait half is what turns "the gate says no" into "the gate never got to look".
function spentText(v: VerifyVerdict): string {
  if (v.ms === undefined) return "";
  const s = (ms: number): string => `${Math.round(ms / 1000)}s`;
  return ` (ran ${s(v.ms)}${v.waitMs !== undefined ? `, ${v.waitPartial ? "at least " : ""}${s(v.waitMs)} of it queued behind the suite mutex` : ""})`;
}
// pre-land review: show the diff that will land on main (main...HEAD, three-dot) BEFORE it
// lands. Closes the gap where a conflict-free rebase auto-landed with no diff ever shown —
// "textually clean" isn't "semantically correct", so the owner gets one look before it merges.
// the one deterministic land signal made visible (F-A.3): did the rebased tree pass verify.
// Informational only — a red, skipped, timed-out or stale badge NEVER disables land (owner
// latitude stands; confirm-land deliberately does not block on a non-green verify). The FOUR
// ways of having no verdict are told apart and none reads green: no command CONFIGURED reads
// "unverified", a command that DECLINED to run reads "skipped", one our own clock killed while it
// was working reads "timed out", and one killed while it was still queued behind the suite mutex
// reads "never ran" — the last two say nothing whatever about the tree, the last not even "slow".
function verifyBadge(v: VerifyVerdict | undefined): HTMLElement {
  if (!v) {
    const b = el("span", "vbadge none", "unverified");
    b.title = "no FLEET_VERIFY_CMD result on record for this rebased tree — the tree was not deterministically verified";
    return b;
  }
  if (v.waitedOut) {
    // the weakest of the six states, and the one that used to render RED: killed while still
    // queued behind the suite mutex, so the gate never looked at this tree at all
    const b = el("span", "vbadge skip", "verify — never ran");
    b.title = `\`${v.cmd}\` never started${spentText(v)} — it was killed while still queued behind the suite mutex, so this is a fact about the machine and says NOTHING about the tree; click to view how far the chain got`;
    b.onclick = (e) => { e.stopPropagation(); showVerifyOutput(v); };
    return b;
  }
  if (v.timedOut) {
    // wears the same `skip` tone on purpose: both are "nothing was measured", and the one thing
    // this badge must never do is look like the red one — a timeout says nothing about the tree
    const b = el("span", "vbadge skip", "verify — timed out");
    b.title = `\`${v.cmd}\` was KILLED at the work timeout${spentText(v)} — it verified NOTHING, and this is not a verdict about the tree; click to view how far it got`;
    b.onclick = (e) => { e.stopPropagation(); showVerifyOutput(v); };
    return b;
  }
  if (v.serverDown) {
    // the chain's own non-measurement: a suite's server never came up, so no check ran
    const b = el("span", "vbadge skip", "verify — server down");
    b.title = `\`${v.cmd}\` never measured this tree — a suite's own server did not come up, so no check ran; click to view the kept instance's server.log tail`;
    b.onclick = (e) => { e.stopPropagation(); showVerifyOutput(v); };
    return b;
  }
  if (v.ok === null) {
    const b = el("span", "vbadge skip", "verify — skipped");
    b.title = `\`${v.cmd}\` declined to verify this tree (it verified NOTHING — not a pass) — click to view what it said`;
    b.onclick = (e) => { e.stopPropagation(); showVerifyOutput(v); };
    return b;
  }
  if (!v.ok) {
    const b = el("span", "vbadge bad", "verify ✗");
    b.title = `verify failed: ${v.cmd} — click to view output`;
    b.onclick = (e) => { e.stopPropagation(); showVerifyOutput(v); };
    return b;
  }
  if (v.stale) {
    const b = el("span", "vbadge stale", "verify ⚠ stale");
    b.title = `passed \`${v.cmd}\`, but against an older main (verdict void once main moves past it) — re-verify or land at your discretion`;
    return b;
  }
  const b = el("span", "vbadge ok", "verify ✓");
  b.title = `passed \`${v.cmd}\` against the rebased tree`;
  return b;
}

// tail of a non-green verify's captured output — reachable from the red, the skipped and the
// timed-out badge, so the owner can see WHY it failed, what the command said as it declined, or
// how far it got before the clock killed it, before exercising land latitude.
function showVerifyOutput(v: VerifyVerdict): void {
  const skipped = v.ok === null;
  const overlay = el("div", "overlay riskoverlay");
  overlay.style.display = "flex";
  const panel = el("div", "panel riskpanel");
  panel.appendChild(el("h2", "", v.waitedOut ? "verify — never started, output so far"
    : v.timedOut ? "verify — timed out, output so far"
    : v.serverDown ? "verify — a suite server did not come up, output"
    : skipped ? "verify — skipped, output" : "verify ✗ — output"));
  panel.appendChild(el("div", `diffstat ${skipped ? "warn" : "err"}`,
    `${v.cmd} · ${v.waitedOut ? `killed while still queued behind the suite mutex — this tree was never looked at${spentText(v)}`
      : v.timedOut ? `killed at the work timeout — nothing was checked${spentText(v)}`
      : v.serverDown ? "a suite's own server did not come up — nothing was checked"
      : skipped ? "declined to verify this tree — nothing was checked" : "exit non-zero"}`));
  const box = el("div", "difftxt");
  box.textContent = v.out || "(no output captured)";
  panel.appendChild(box);
  const btns = el("div", "riskbtns");
  const close = el("button", "riskbtn", "close") as HTMLButtonElement;
  const finish = () => { document.removeEventListener("keydown", onKey, true); overlay.remove(); };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); finish(); } };
  document.addEventListener("keydown", onKey, true);
  close.onclick = finish;
  overlay.onclick = (e) => { if (e.target === overlay) finish(); };
  btns.append(close);
  panel.appendChild(btns);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

async function showLandReview(title: string, slot: number, verify?: VerifyVerdict): Promise<boolean> {
  // fail CLOSED: a dropped fetch or non-JSON/non-200 body must NEVER read as a clean empty
  // diff — that path renders "just cleans up" with ⏏ enabled and lands agent-resolved
  // conflicts with zero human eyes. Same posture as fetchSlotRisk's UNKNOWN_RISK.
  const data = await api(`/api/slots/${slot}/merge-diff`)
    .then(async (r) => (r.ok ? await r.json() : { loadFailed: true }))
    .catch(() => ({ loadFailed: true })) as
    { main?: string; branch?: string; files?: string[]; diff?: string; truncated?: boolean; error?: string; loadFailed?: boolean };
  return new Promise((resolve) => {
    const overlay = el("div", "overlay riskoverlay");
    overlay.style.display = "flex";
    const panel = el("div", "panel riskpanel landreviewpanel");
    panel.appendChild(el("h2", "", title));
    panel.appendChild(el("div", "landhint",
      "This is the merge preview — everything that will land on main (main…HEAD). Committing does NOT clear it; only landing does. A clean worktree with commits ahead is exactly what a ready-to-land lane looks like."));
    if (data.loadFailed) {
      panel.appendChild(el("div", "diffstat err",
        "couldn't load the merge preview — landing is disabled until it loads. Retry, or check the connection."));
    } else if (data.error) {
      panel.appendChild(el("div", "diffstat", data.error));
    } else {
      const n = data.files?.length ?? 0;
      const stat = el("div", "diffstat",
        `${data.branch ?? "?"} → ${data.main ?? "main"} · ${n} file${n === 1 ? "" : "s"}${data.truncated ? " · diff truncated" : ""} `);
      stat.appendChild(verifyBadge(verify));
      panel.appendChild(stat);
      if (data.diff) { const box = el("div", "difftxt"); renderDiffInto(box, data.diff); panel.appendChild(box); }
      else panel.appendChild(el("div", "diffstat", "no committed changes to land — landing just cleans up the worktree"));
    }
    const btns = el("div", "riskbtns");
    const cancel = el("button", "riskbtn", "cancel") as HTMLButtonElement;
    const go = el("button", "riskbtn", "⏏ land") as HTMLButtonElement;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); finish(false); } };
    const finish = (ok: boolean) => { document.removeEventListener("keydown", onKey, true); overlay.remove(); resolve(ok); };
    document.addEventListener("keydown", onKey, true);
    cancel.onclick = () => finish(false);
    go.onclick = () => finish(true);
    overlay.onclick = (e) => { if (e.target === overlay) finish(false); };
    if (data.loadFailed) {
      go.disabled = true; // fail closed — no land gesture without a diff that actually loaded
      const retry = el("button", "riskbtn", "retry") as HTMLButtonElement;
      retry.onclick = () => { document.removeEventListener("keydown", onKey, true); overlay.remove(); resolve(showLandReview(title, slot, verify)); };
      btns.append(cancel, retry, go);
    } else {
      btns.append(cancel, go);
    }
    panel.appendChild(btns);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  });
}

async function doCommitMain(slot: number, mode: "quick" | "agent", files: string[]): Promise<void> {
  if (commitBusy.has(slot)) return;
  const tracked = files.filter((f) => !f.startsWith("??"));
  const untracked = files.filter((f) => f.startsWith("??"));
  if (!tracked.length) {
    alert("Only untracked files here — nothing tracked to commit. A main-session commit stages tracked changes only (git add -u); add the files in the terminal first if you want them in.");
    return;
  }
  const ok = await showCommitPreview(`Commit ${tracked.length} tracked file${tracked.length === 1 ? "" : "s"} in ${baseName(fleet[slot - 1]?.cwd ?? "")}?`, tracked, untracked, sessionActive(slot));
  if (ok) await doCommit(slot, mode, true); // the preview already carried the mid-run warning
}

async function newLane(repo: string, parent?: LaneAnchor): Promise<void> {
  if (laneReqBusy) return;
  laneReqBusy = true;
  try {
    // The server still picks the first free slot. A main-row click additionally names the exact
    // SESSION OCCUPANT it came from; generic board/repo-header creation omits `parent` and lets the
    // server make its one-time fallback choice. Never send a slot alone — slots recycle.
    const r = await post("/api/lanes", { repo, ...(parent ? { parent } : {}) });
    const j = (await r.json().catch(() => ({}))) as { slot?: number; error?: string };
    if (!r.ok) { alert(`Lane failed: ${j.error ?? "?"}`); return; }
    await refresh();
    if (j.slot) showSlot(j.slot);
  } finally {
    laneReqBusy = false;
  }
}

function applyBoard() {
  document.body.classList.toggle("board", boardOpen && !isMobile());
  // the toggle lives per-pane (next to the 💬 viewtoggle) — sync them all
  for (const b of document.querySelectorAll<HTMLButtonElement>(".boardtoggle"))
    b.classList.toggle("active", boardOpen);
}
function setBoard(on: boolean) {
  boardOpen = on;
  localStorage.setItem("fleet.board", on ? "1" : "0");
  applyBoard();
  // the board's width changed → terminals must refit (same rule as the sidebar collapse)
  requestAnimationFrame(() => { for (const p of panes) p.refit(); });
  if (on) void renderBoard();
}

async function pollOutline(slot: number): Promise<string[]> {
  const c = outline.get(slot) ?? { total: 0, source: null, prompts: [] };
  try {
    const res = await api(`/api/slots/${slot}/transcript?after=${c.total}`);
    if (!res.ok) return c.prompts;
    const data = (await res.json()) as { entries: TEntry[]; total: number; source: string | null };
    // fresh claude after a self-heal → transcript restarted; rebuild from the top
    if (c.source !== null && data.source !== c.source) {
      outline.set(slot, { total: 0, source: data.source, prompts: [] });
      return [];
    }
    c.source = data.source;
    for (const e of data.entries) {
      if (e.role !== "user") continue;
      // one outline row per user text block — exactly mirrors the .msg.user elements
      // appendEntry creates, so row index i maps to showPromptAt(i)
      for (const b of e.blocks) {
        if (b.t !== "text") continue;
        const first = b.text.split("\n").find((l) => l.trim()) ?? "";
        c.prompts.push(first.trim().slice(0, 100) || "(empty)");
      }
    }
    c.total = data.total;
    outline.set(slot, c);
  } catch {
    // transient fetch error — next render retries
  }
  return c.prompts;
}


// --- the verify gate, at the top of the board ---------------------------------------------
// Suites are serial on this machine (a machine-wide mkdir mutex, e2e-stage.sh) and until now that
// serialization was invisible: a run could sit in a 15s poll loop, or die under a neighbour, with
// nothing on any surface saying so. This is the reading half. It shows two DIFFERENT things and
// never blends them — the lock is measured off the filesystem, the phase rows are what lanes said
// about themselves. It is machine-level, like `guests`, which is why it sits above `identity` and
// survives the empty-pane branch: it is not about the session under the cursor.
//
// Tolerant on the wire on purpose: an older server sends no `gate` at all and this must then be
// absent, never "no suite is running" — which is a claim, and one nothing here has measured.
// `slot: null` is a run with no session behind it — the tier-2 post-land audit, which is fleet's
// own work and owned by no pane. `origin` and `branch` are optional for the same wire-tolerance
// reason the whole shape is: a server from before 2026-08-19 sends neither, and a row without an
// origin must then read as the only kind that server had — a lane's own word.
interface GateInfo {
  lock: { pid: number | null; alive: boolean | null; heldMs: number; ageMs?: number; acquiredAt?: number | null;
    identityProven?: boolean | null; birth?: { stored: string | null; current: string | null; state: string };
    nextAction?: string; reason?: string; effect?: string; state?: string } | null;
  reports: { slot: number | null; label: string | null; phase: string; suite: string; exitCode: number | null; at: number;
    origin?: string; branch?: string | null }[];
}
let gateInfo: GateInfo | null = null;
// fmtDur rounds to whole minutes, which reads as "0m" for the first half-minute of a hold — the
// exact window in which someone is watching to see whether a suite actually started.
// Clamped because a report's age is a SERVER timestamp against this device's clock, and a phone
// running a few seconds ahead must read "0s", never a negative age.
const gateAge = (ms: number): string => (ms < 90_000 ? `${Math.max(0, Math.round(ms / 1000))}s` : fmtDur(Math.max(0, ms)));

// --- ...and WHO is holding it: the post-land audit in flight ------------------------------------
// The lock line above can say "held by pid 44219 for 4m" and nothing more — not whether that holder
// is the tier-2 audit or a lane's own suite, and not which commit it is measuring. Both facts exist
// on the server (server.ts, postLandAuditLiveView) and had no reader, so the only way to watch a
// running audit was `ps`. This is that reader, and it lives INSIDE the gate section on purpose: the
// audit usually IS the lock holder, so the identity belongs on the line right under the hold.
//
// Two things are drawn that a single elapsed number cannot say:
//   · p50/p90 of past runs on this repo. "Running 4:12" is not an answer; "4:12, p50 8:18" is.
//   · the lands that are WAITING. A land during a run is folded into the NEXT run (the coalescing
//     contract), so there are routinely lands whose audit has not begun — today indistinguishable
//     from "no audit planned", which is one of the three signatures the Rundgang is asked to spot.
let postLandLive: PostLandAuditLiveInfo | null = null;
// m:ss, not fmtDur's whole minutes. This number ticks once a second in front of someone deciding
// whether to keep waiting, and a display that reads "8m" for sixty seconds looks frozen — which is
// the state ("is it still going?") this surface exists to answer.
const mmss = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
function auditLiveRows(): HTMLElement[] {
  const live = postLandLive;
  if (!live) return [];
  const rows: HTMLElement[] = [];
  const r = live.running;
  if (r?.phase === "starting") {
    // the drain holds its one-at-a-time lock but no run has stamped itself. Named rather than
    // folded into "nothing is running", which is the one thing this state is NOT.
    const row = el("div", "bstate", "⏳ post-land audit · starting — a run is claimed, its target is not stamped yet");
    row.title = "The tier-2 drain holds its lock. This is not an idle machine and not a wedge; it is the moment before a run names its tree.";
    rows.push(row);
  } else if (r) {
    const st = live.stats;
    // the elapsed clock is derived from `startedAt` and THIS device's clock, so it ticks between
    // polls. Clamped inside mmss for the same reason gateAge clamps: a phone a few seconds ahead of
    // the server must read 0:00, never a negative age.
    const age = el("span", "", mmss(Date.now() - (r.startedAt ?? Date.now())));
    const iv = setInterval(() => {
      if (!age.isConnected) { clearInterval(iv); return; }
      age.textContent = mmss(Date.now() - (r.startedAt ?? Date.now()));
    }, 1000);
    const sha = (r.mainSha ?? "").slice(0, 8);
    const row = el("div", "bstate");
    // `mainSha: null` is "the run has not resolved its tip yet" — a real moment at the head of every
    // run, and it says so rather than printing an empty sha that would read as a bug in this line.
    row.appendChild(document.createTextNode(
      `⏳ post-land audit · ${r.repo ?? "?"} ${r.main ?? "?"}@${sha || "(tip not resolved yet)"} · running `));
    row.appendChild(age);
    if (st) row.appendChild(document.createTextNode(` · p50 ${mmss(st.p50)} · p90 ${mmss(st.p90)} (n=${st.n})`));
    row.title = st
      ? `The full suite against the integration tip, tier 2 — it gates nothing. p50/p90 are past runs of this repo (n=${st.n}); past p90 is when a run stops looking ordinary.`
      : "The full suite against the integration tip, tier 2 — it gates nothing. Too few past runs on this repo to say what normal looks like.";
    rows.push(row);
    if (r.covers.length) {
      const c = el("div", "bidmeta", `covering ${r.covers.join(", ")}`);
      c.title = "The land(s) this one run stands for. A run is coalesced: it audits a TREE, so it covers every land folded into that tree.";
      rows.push(c);
    }
  }
  for (const w of live.waiting) {
    const row = el("div", "bidmeta", `waiting for an audit · ${w.branch} → ${w.main}@${w.mainAfter.slice(0, 8)} · landed ${gateAge(Date.now() - w.at)} ago`);
    row.title = "This land has no audit yet — it is folded into the NEXT run. Not the same as 'no audit planned', which is what it used to look like.";
    rows.push(row);
  }
  return rows;
}

function gateSection(): HTMLElement | null {
  const g = gateInfo;
  const liveRows = auditLiveRows();
  // an audit can be in flight (or lands waiting) while the mutex says nothing — and the reverse.
  // Neither half may suppress the other.
  if (!g && !liveRows.length) return null;
  const sec = el("div", "bsec");
  // ...but a server that sends no `gate` at all has MEASURED nothing, and "lock free" would be a
  // claim. The mutex half is drawn only when the server actually spoke about it.
  if (g) sec.appendChild(gateLockHead(g.lock));
  for (const row of liveRows) sec.appendChild(row);
  for (const r of g?.reports ?? []) {
    // a slotless row is fleet's own work (the tier-2 audit); its label names the repo instead. The
    // fallback is for that row alone — "slot null" would read as a bug in this line, not on the wire.
    const who = r.slot === null ? (r.label ?? "fleet itself") : `slot ${r.slot}${r.label ? ` · ${r.label}` : ""}`;
    const what = r.phase === "failed" && r.exitCode !== null ? `failed exit ${r.exitCode}` : r.phase;
    const where = r.branch ? ` · ${r.branch}` : "";
    const row = el("div", "bidmeta", `${who} · ${what} ${r.suite}${where} · ${gateAge(Date.now() - r.at)}`);
    // MEASUREMENT vs HEARSAY, the distinction the server keeps on the wire (`origin`) and this is
    // the reader that must not blur it: a lane's row is its own word about itself, fleet's row is
    // written by the process actually running the suite. Neither one gates anything.
    row.title = r.origin === "server"
      ? "Fleet's own run, reported by the process running it — this one is measured, not volunteered. It still gates nothing: the mutex decides what runs."
      : "Self-reported by that lane. Advisory — the mutex, not this, decides what runs.";
    sec.appendChild(row);
  }
  return sec;
}
function gateLockHead(lk: GateInfo["lock"]): HTMLElement {
  // the server names the state (it owns the overdue threshold — see SUITE_HOLD_OVERDUE_MS). The
  // fallback is for the deploy window where a newer bundle is served by an older server: it can
  // reproduce every state but `overdue`, so it under-warns rather than inventing one.
  const state = lk ? lk.state ?? (lk.alive === null ? "parked" : lk.alive ? "held" : "stale") : "free";
  // `pid null` is a lock file whose contents are not a pid — a lost holder either way, but
  // printing "pid null" would read as a bug in this line rather than as one on disk.
  const who = lk?.pid === null ? "unreadable pid file" : `pid ${lk?.pid}`;
  const age = gateAge(lk?.ageMs ?? lk?.heldMs ?? 0);
  const id = lk?.identityProven === true ? "identity proven"
    : lk?.identityProven === false ? "identity mismatch"
    : "identity unknown";
  // gateAge measures from the CLAIM (the pid file's mtime), not from the holder's death — which
  // nothing here knows. So a dead holder is "claimed 18m ago", never "ended 18m ago".
  const head = el("div", "bstate",
    !lk ? "· suite gate · lock free"
      : state === "parked" ? `⏸ suite gate · parked by hand (no pid) · ${age}`
      : state === "held" ? `⏳ suite gate · held by ${who} · ${id} · ${age}`
      : state === "overdue" ? `⚠ suite gate · ${who} has held for ${age} · ${id} — longer than any suite here takes`
      : state === "unknown" ? `? suite gate · holder identity unknown (${who}) · ${age}`
      // NEUTRAL on purpose: every finished suite leaves its dir behind (release is implicit), so
      // this is what an idle machine looks like — it was a ⚠ for one day and shouted constantly.
      : `· suite gate · no suite running · stale lock (${who}, ${id}, claimed ${age} ago)`);
  head.title = state === "free" ? "No suite is holding the machine-wide mutex right now."
    : lk?.reason || lk?.effect
      ? `reason: ${lk.reason ?? "unknown"}; next: ${lk.nextAction ?? "unknown"}; effect: ${lk.effect ?? "unknown"}`
    : state === "stale" ? "Nothing is running. A finished suite leaves its lock dir behind by design; the next suite clears it."
    : state === "overdue" ? "This holder is still alive but has held far longer than any suite on this machine takes — check whether it is wedged."
    : "The machine-wide suite mutex, read off disk. Fleet only reads it — reaping a dead holder belongs to the wrappers.";
  return head;
}

// --- WHICH MACHINES TAKE WORK OFF THIS BOX: the helper device register --------------------------
// The board's only view of the second machine. It sits with the gate line rather than in the lane
// story because it is a fact about the MACHINE ROOM, not about the lane under the cursor: which
// helpers exist, whether they are beating, what the owner asked of them, what they hold right now.
//
// EVERY FIELD BELOW IS FOREIGN DATA. The name, the reported mode, the load and the capability list
// are strings another machine chose and this fleet stores verbatim; they reach the DOM only through
// `el()` / createTextNode (textContent), never as markup and never interpolated into one. Wire
// shape is tolerant on purpose — an older server sends no `helperDevices` at all (the panel is then
// absent, which is what "no register" looks like), and a device that has never reported a mode has
// no `mode` key. `mode` is typed as a plain string, not the closed set: a value this client does
// not know must render as the text it is, never be silently mapped onto one this client does know.
interface HelperDeviceClaim { kind?: string; repo: string; ref: string; expiresAt: number }
interface HelperDeviceUpdate {
  state?: string; requestedAt?: number; mainSha?: string;
  result?: { ok?: boolean; exitCode?: number | null; mainSha?: string; note?: string };
}
interface HelperDeviceInfo {
  id: string; name: string; lastSeen: number;
  mode?: string; load?: number; capabilities?: string[];
  desiredMode?: string; desiredSet?: boolean;
  claims?: HelperDeviceClaim[]; lapses?: number;
  daemonSha?: string; update?: HelperDeviceUpdate | null;
  // the capacity pair, shipped together or not at all (server.ts#helperDevicesView). Optional for
  // the usual back-compat reason: a device that never reported them draws no line rather than a
  // number this page made up.
  maxParallelSuites?: number; running?: number;
  // the wake rail. `wakeConfigured` is optional here and NOT on the server for the usual reason:
  // an older server sends neither field, and `undefined` has to stay distinguishable from a server
  // that answered "no MAC, no address" — the first draws nothing, the second says so.
  lastWakeAt?: number; wakeConfigured?: boolean;
}
// ONLINE/OFFLINE IS DERIVED, NEVER STORED — the same reading that makes a claim expire: there is no
// "offline" event anywhere in this system, only a heartbeat that stopped arriving.
// THE WINDOW IS THE SERVER'S AND IS READ, NEVER SPELLED. This file used to carry its own module
// constant holding the same 90-second figure, and the server answered the same question from a
// second copy of it as soon as /api/self/gate learned to — two programs deciding "is that machine
// there?" separately is exactly the drift the projection exists to prevent. It now arrives beside
// the register (server.ts#DEVICE_ONLINE_MS), and e2e/pins.ts §S11 pins the single source: that pin
// counts DECLARATIONS, so this paragraph deliberately names the old constant nowhere.
// `null` = the server sent rows without a window, which only an OLDER server does. That is not
// "offline" and is not "online": the dot says the window was not served and prints the age anyway,
// because the age is a measurement and the verdict would be an invention.
// The age is ALWAYS printed next to the word, so "offline" is never a bare claim: it says how long
// ago the last beat was and lets the owner judge the gap themselves.
let deviceOnlineMs: number | null = null;
// The closed set the owner can wish for. It is the server's `DEVICE_MODES` (server.ts) spelled a
// second time — deliberately not pinned: the server validates the value and refuses anything else
// with a 400 the button surfaces, so a drift here is a loud button, not a silent wrong state.
const DEVICE_WISH_MODES = ["active", "quiet", "off"] as const;
const DEVICE_WISH_TITLE: Record<string, string> = {
  active: "Take work: the daemon polls for jobs and may claim them.",
  quiet: "Finish what you hold, take nothing new.",
  off: "Stop polling entirely. Anything it holds lapses and falls back to this box.",
};
let helperDevicesInfo: HelperDeviceInfo[] = [];
function devicesSection(): HTMLElement | null {
  // no register, no chrome — the same rule the gate and deploy lines follow. A fleet that has never
  // seen a helper draws nothing at all here.
  if (!helperDevicesInfo.length) return null;
  const sec = el("div", "bsec");
  sec.appendChild(el("h3", "", "helper devices"));
  for (const d of helperDevicesInfo) sec.appendChild(deviceCard(d));
  return sec;
}
function deviceCard(d: HelperDeviceInfo): HTMLElement {
  const box = el("div", "bdev");
  box.appendChild(el("div", "bidhead", d.name));
  const age = Math.max(0, Date.now() - d.lastSeen);
  const online = deviceOnlineMs === null ? null : age < deviceOnlineMs;
  const state = el("div", "bstate");
  const dot = el("span", online ? "ready" : "",
    online === null ? "○ heartbeat window not served" : online ? "● online" : "○ offline");
  dot.title = online === null
    ? `This server sent the register without its online window, so nothing here can say whether ${gateAge(age)} is inside it. The age is measured; the verdict is not invented.`
    : online
      ? `Its last heartbeat is ${gateAge(age)} old — younger than the ${Math.round(deviceOnlineMs! / 1000)}s window. Derived from lastSeen; nothing here pings the machine.`
      : `Nothing has been heard from it for ${gateAge(age)} (window: ${Math.round(deviceOnlineMs! / 1000)}s). That is a silence, not a report — the machine may be off, asleep, or simply not running the daemon.`;
  state.appendChild(dot);
  // the device's OWN reading of itself, and absent means it never said — not "active"
  state.appendChild(document.createTextNode(
    ` · ${d.mode ? `reports ${d.mode}` : "has never reported a mode"} · last beat ${gateAge(age)} ago`));
  state.title = "What the device says about itself, from its last heartbeat. It is a report, not a setting — the owner's wish is the row below.";
  box.appendChild(state);
  // the owner's half: a wish, stored and nothing more. The device finds out on its next heartbeat.
  const wish = el("div", "bidmeta", d.desiredSet
    ? "your wish for it:"
    : "your wish for it: never set — the default below is what it pulls");
  wish.title = "Stored only. Fleet never opens a connection to that machine: it reads this wish in the reply to its own next heartbeat, or never, if it has stopped beating.";
  box.appendChild(wish);
  const row = el("div", "bbtnrow");
  const btns: HTMLButtonElement[] = [];
  for (const m of DEVICE_WISH_MODES) {
    const b = el("button", `bbtn subtle${d.desiredMode === m ? " on" : ""}`, m) as HTMLButtonElement;
    b.title = DEVICE_WISH_TITLE[m] ?? m;
    b.onclick = async () => {
      for (const x of btns) x.disabled = true;
      const res = await post(`/api/helper/devices/${encodeURIComponent(d.id)}/mode`, { mode: m });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        alert(j?.error ?? "the mode could not be set");
        for (const x of btns) x.disabled = false;
        return;
      }
      // paint the answer at once rather than waiting for the next 2 s poll — the same row is
      // rebuilt from the server's own payload on that poll either way, so this can only be early,
      // never wrong.
      d.desiredMode = m;
      d.desiredSet = true;
      repaintDevices();
    };
    btns.push(b);
    row.appendChild(b);
  }
  box.appendChild(row);
  for (const c of d.claims ?? []) {
    const what = c.kind === "lane-suite" ? "a lane preview" : c.kind === "audit" ? "an audit" : `a ${c.kind ?? "?"} job`;
    const r = el("div", "bidmeta", `holds ${what} · ${c.repo} ${c.ref} · ${gateAge(Math.max(0, c.expiresAt - Date.now()))} left`);
    r.title = "Work this machine has taken off this box. The local drain skips it until the claim expires; past that it falls back here, whether or not the helper ever answers.";
    box.appendChild(r);
  }
  // ALWAYS drawn, including the zero: "this device has never dropped a job" is the fact the owner
  // is looking for, and an omitted line would be indistinguishable from a device with no history.
  const lap = el("div", "bidmeta", d.lapses === undefined
    ? "lapse count not reported by this server"
    : d.lapses === 0 ? "no lapses" : `${d.lapses} lapse${d.lapses === 1 ? "" : "s"}`);
  lap.title = "A lapse is a job this device claimed and never answered for. Counted by device identity; rows booked before that identity was recorded join by NAME, so a device renamed since then does not carry its older lapses here.";
  box.appendChild(lap);
  // what it says it is carrying, and what it says it can run — reported, uncorroborated, and drawn
  // only when it actually said something
  const rep: string[] = [];
  if (d.load !== undefined) rep.push(`load ${d.load}`);
  // THE LINE `load` COULD NEVER GIVE: how many of the runs on that box are this fleet's, and how
  // many more it will take. Drawn from the device's own count, never derived from the claims list —
  // a claim is held here, a run happens there, and the gap between them is the thing worth seeing.
  if (d.maxParallelSuites !== undefined)
    rep.push(`${d.running ?? 0}/${d.maxParallelSuites} suite slot${d.maxParallelSuites === 1 ? "" : "s"}`);
  if (d.capabilities?.length) rep.push(`can run ${d.capabilities.join(", ")}`);
  if (rep.length) {
    const r = el("div", "bidmeta", rep.join(" · "));
    r.title = "Reported by the device itself on its last heartbeat. Nothing on this box reads these — they are for your eye.";
    box.appendChild(r);
  }
  // the commit the daemon says it runs from — 8 digits, measured on the other machine at its own
  // boot, absent when that daemon predates the field or runs from a plain copy. Beside it, the
  // owner's standing update wish and how it went; the two shas agreeing is what "the update took"
  // looks like, and the board only ever compares — it never restarts anything over there.
  // THE ONE BUTTON ON THIS BOARD THAT REACHES OUT. Drawn only where the server said the frame
  // would go somewhere (`wakeConfigured`), because a button that can only ever 409 teaches the
  // owner to distrust the panel. Absent field = an older server = no row at all, which is the same
  // silence every other back-compat read here produces.
  if (d.wakeConfigured !== undefined) {
    const wrow = el("div", "bbtnrow");
    if (d.wakeConfigured) {
      const wb = el("button", "bbtn subtle", "wecken") as HTMLButtonElement;
      wb.title = "Send one Wake-on-LAN magic packet to that machine's MAC. The single exception to \"Fleet never opens anything towards a helper\": a broadcast frame with no credential, no session and no reply. It says the frame LEFT this box — never that the machine woke up.";
      wb.onclick = async () => {
        wb.disabled = true;
        const res = await post(`/api/helper/devices/${encodeURIComponent(d.id)}/wake`, {});
        const j = (await res.json().catch(() => null)) as { sent?: boolean; at?: number; error?: string } | null;
        if (!res.ok || j?.sent !== true) alert(j?.error ?? "the wake frame could not be sent");
        // stamped from the server's own `at` either way: the field is "last attempt", and the 2 s
        // poll rebuilds this row from the same value.
        if (typeof j?.at === "number") d.lastWakeAt = j.at;
        wb.disabled = false;
        repaintDevices();
      };
      wrow.appendChild(wb);
    }
    const stamp = el("div", "bidmeta", !d.wakeConfigured
      ? "wake not configured on this Fleet host (no MAC for this device, or no broadcast address)"
      : d.lastWakeAt ? `last wake frame ${gateAge(Math.max(0, Date.now() - d.lastWakeAt))} ago`
        : "never woken from here");
    stamp.title = "When a magic packet last LEFT this box for that machine. There is no acknowledgement to record — whether it arrived is answered only by the next heartbeat.";
    if (d.wakeConfigured) box.appendChild(wrow);
    box.appendChild(stamp);
  }
  const shaLine = el("div", "bidmeta", d.daemonSha ? `daemon at ${d.daemonSha.slice(0, 8)}` : "daemon sha not reported");
  shaLine.title = "git rev-parse HEAD of the tree the daemon started from, sent on its heartbeat. Not a setting: it is what is running there right now.";
  box.appendChild(shaLine);
  const u = d.update;
  if (u && u.state) {
    const target = u.result?.mainSha ?? u.mainSha;
    const went = u.state === "reported"
      ? (u.result?.ok ? "swapped — restarting from the new tree" : `failed${u.result?.note ? `: ${u.result.note}` : ""}`)
      : u.state === "claimed" ? "being applied" : "queued — it takes it on its next poll";
    const applied = u.state === "reported" && u.result?.ok && target && d.daemonSha === target;
    const ul = el("div", "bidmeta",
      `update${target ? ` to ${target.slice(0, 8)}` : ""}: ${applied ? "applied — the daemon now runs it" : went}`);
    ul.title = "Queued by you on this board, taken by the daemon on its own poll: clone, parse-check, symlink swap, exit 75, restart by systemd. The old tree stays on the machine as the way back.";
    box.appendChild(ul);
  }
  return box;
}

// --- ...AND THE WAY IN: the 💻 button and its overlay -------------------------------------------
// The section above lives inside the SESSION BRIEF board, which is opened per pane and is
// desktop-only (renderBoard bails at isMobile()). That made the register something you could only
// see while looking at a lane, and never from the phone — for the one surface whose whole point is
// "both machines in ONE UI", that is the wrong front door. So the same cards get a door of their
// own beside 📣/📥, built from the SAME deviceCard(): two renderers of one row would be two
// chances to disagree about what a device is doing.
const devdlg = $("devdlg"), devpanel = $("devpanel"), devbtn = $("devbtn");
const devIsOpen = (): boolean => devdlg.style.display === "flex";
// A device that is not beating while it HOLDS work is the one state on this panel that wants the
// owner's eye: the claim is still the helper's until it expires, so this box is not auditing that
// tree and the other one may or may not be. It is a LOOKING GLASS like the ops inbox — nothing
// here reaps, requeues or fails anything; the claim's own deadline does that, on its own clock.
// …and with no window served there is no such thing as "not beating": the list is empty rather
// than guessed, so the ⚠ badge can never be raised on a threshold this client made up.
const devStale = (): HelperDeviceInfo[] =>
  deviceOnlineMs === null ? []
    : helperDevicesInfo.filter((d) => Date.now() - d.lastSeen >= deviceOnlineMs! && (d.claims?.length ?? 0) > 0);
function renderDevBtn() {
  const n = helperDevicesInfo.length;
  const m = devStale().length;
  devbtn.textContent = `💻${n > 0 ? n : ""}${m > 0 ? ` ⚠${m}` : ""}`;
  devbtn.classList.toggle("hot", m > 0);
  devbtn.title = n === 0
    ? "helper devices — no machine has ever registered here"
    : `${n} helper device${n === 1 ? "" : "s"}`
      + (m > 0 ? ` · ${m} holding work while not beating` : "")
      + " — the machines that take suite and audit work off this box";
  // same rule as 📣 and 📥: no affordance while there is nothing behind it, so the icon means
  // something the moment it appears. It stays while the dialog is open, or closing it would
  // remove the button under the owner's cursor.
  devbtn.style.display = n > 0 || devIsOpen() ? "" : "none";
}
// ONE entry point for "the register moved": the poll calls it, and so does the wish-mode button,
// which is why deviceCard can repaint both surfaces without knowing which one it is drawn in.
function repaintDevices() {
  renderDevBtn();
  if (devIsOpen()) renderDevDlg();
  void renderBoard();
}
function closeDevDlg() {
  devdlg.style.display = "none";
  renderDevBtn();
}
devdlg.addEventListener("click", (e) => {
  if (e.target === devdlg) closeDevDlg();
});
function renderDevDlg() {
  devpanel.replaceChildren();
  devpanel.appendChild(el("h2", "", "Helper devices — the machines that take work off this box"));
  if (!helperDevicesInfo.length) {
    // reachable only with the dialog already open when the last device is evicted
    devpanel.appendChild(el("div", "shrhint", "No device has ever registered here."));
  } else {
    devpanel.appendChild(el("div", "shrhint",
      "Online/offline is DERIVED from the last heartbeat, never reported: a machine that stops "
      + "beating simply goes quiet, and anything it holds falls back to this box when its claim "
      + "expires. The mode you pick is a WISH — it is stored here and the device reads it on its "
      + "own next heartbeat; nothing on this box ever calls out to that machine."));
    for (const d of helperDevicesInfo) devpanel.appendChild(deviceCard(d));
  }
  const btns = el("div", "shrbtns");
  const close = el("button", "shrbtn", "close") as HTMLButtonElement;
  close.onclick = closeDevDlg;
  btns.appendChild(close);
  devpanel.appendChild(btns);
}
devbtn.onclick = () => {
  setDrawer(false);
  devdlg.style.display = "flex";
  renderDevDlg();
};
renderDevBtn();

// --- is a deploy due? ------------------------------------------------------------------------
// Landing is not deploying, and building is not landing. Both facts existed already but were
// served only to the steward, so the owner — the only principal who restarts srv or runs the
// build — could not see either. Drawn ONLY when something is actually due: an idle fleet gets no
// row at all, and an UNKNOWN (null) draws nothing either, because a permanent "can't tell" line
// is the same noise the suite-gate line just had removed.
interface DeployGapInfo { bootHead: string | null; head: string | null; behindCount: number | null; codeBehind: boolean | null }
interface BundleStaleInfo {
  appJsMtime: number | null; shareJsMtime: number | null; helperJsMtime: number | null;
  srcNewestMtime: number | null; stale: boolean | null;
}
let deployGapInfo: DeployGapInfo | null = null;
let bundleStaleInfo: BundleStaleInfo | null = null;
function deploySection(): HTMLElement | null {
  const codeDue = deployGapInfo?.codeBehind === true;
  const bundleDue = bundleStaleInfo?.stale === true;
  if (!codeDue && !bundleDue) return null;
  const sec = el("div", "bsec");
  if (codeDue) {
    const n = deployGapInfo?.behindCount ?? null;
    const row = el("div", "bstate",
      `⚠ deploy due · srv is running server code from ${n === null ? "an earlier commit" : `${n} commit${n === 1 ? "" : "s"} ago`} — restart srv`);
    row.title = "The running server booted from an older commit than HEAD, and the difference touches server code. Measured against the COMMITTED tree, not the working copy.";
    sec.appendChild(row);
  }
  if (bundleDue) {
    const row = el("div", "bstate", "⚠ deploy due · the client bundle is older than src/ — run bun run build");
    row.title = "public/*.js are gitignored build artifacts: landed client code stays invisible in the browser until someone rebuilds them.";
    sec.appendChild(row);
  }
  return sec;
}

// --- has the server thrown? -------------------------------------------------------------------
// The counterpart to the audit trail: that one shows what Fleet DID, this one what broke while it
// was doing it. Until now the only channel was an unrotated server.log that e2e-stage.sh calls
// "a server.log nobody reads" in its own source — so a 500 on a button press left no mark anywhere
// the owner looks. Machine-level like the gate and deploy lines, drawn ONLY when something has
// actually thrown, and tolerant on the wire: an older server sends no `errors` at all and this
// must then be absent, never "no errors" — which is a claim, and one nothing here has measured.
interface ErrorsInfo {
  total: number; distinct: number; since: number;
  last: { at: number; where: string; msg: string; n: number };
}
interface ErrorRow { where: string; msg: string; first: number; last: number; n: number }
let errorsInfo: ErrorsInfo | null = null;
// the rows, fetched on the click that asks for them and never from the 3 s repaint (the rule
// /api/sessions was shrunk for). `null` = not asked yet. The cache key carries `since` as well as
// `total` BECAUSE the list dies with the server: after a restart both counters start again from
// zero, so a total alone would match a stale cache and paint a dead process's errors as live ones.
let errorRows: { key: string; rows: ErrorRow[] } | null = null;
const errorKey = (e: ErrorsInfo): string => `${e.since}:${e.total}`;
let errorsOpen = false;
function errorsSection(): HTMLElement | null {
  const e = errorsInfo;
  if (!e) return null;
  const sec = el("div", "bsec");
  const many = e.total !== e.distinct;
  const head = el("div", "bstate",
    `⚠ ${e.total} server error${e.total === 1 ? "" : "s"}${many ? ` · ${e.distinct} distinct` : ""}`
    + ` · since ${fmtTs(e.since)}`);
  head.title = "Thrown by the server since it booted. Held in memory only — a restart clears this list,"
    + " and server.log keeps the history. Click for the rows.";
  // inline rather than a new class: the stylesheet lives in public/index.html, which the demo repo
  // derives its own page from (CLAUDE.md) — and a lane cannot build that repo to check it. One
  // property here has no reach outside this file; a rule there has one nothing available can test.
  head.style.cursor = "pointer";
  head.onclick = () => {
    errorsOpen = !errorsOpen;
    // one fetch per (boot, total): reopening after nothing new happened costs no request
    if (errorsOpen && errorRows?.key !== errorKey(e)) {
      void api("/api/errors").then(async (r) => {
        if (!r.ok) return;
        const j = (await r.json()) as { errors?: ErrorRow[] };
        errorRows = { key: errorKey(e), rows: j.errors ?? [] };
        void renderBoard();
      });
    }
    void renderBoard();
  };
  sec.appendChild(head);
  const last = e.last;
  sec.appendChild(el("div", "bidmeta",
    `last · ${last.where} · ${last.msg}${last.n > 1 ? ` ×${last.n}` : ""} · ${fmtTs(last.at)}`));
  if (errorsOpen) {
    // rows one poll behind the COUNTER are still drawn — a row that arrived a second ago is a true
    // thing that happened, and blanking the list mid-fetch would hide it. Rows from a previous BOOT
    // are not: this server never threw them, and the header above already says "since <this boot>".
    const live = errorRows?.key.startsWith(`${e.since}:`) ? errorRows.rows : [];
    for (const r of live) {
      const row = el("div", "bidmeta", `${r.where} · ${r.msg}${r.n > 1 ? ` ×${r.n}` : ""} · ${fmtTs(r.last)}`);
      row.title = r.n > 1 ? `${r.n}× — first ${fmtTs(r.first)}, last ${fmtTs(r.last)}` : `once, ${fmtTs(r.first)}`;
      sec.appendChild(row);
    }
  }
  return sec;
}

// --- the file explorer (§F5) --------------------------------------------------------------
//
// The tree is `git ls-files` and nothing else — see the /api/tree comment in server.ts for why,
// and for the one thing it therefore cannot show (untracked files; the card above shows those).
// `-z` also means the server's list is the ONE git path shape that is never quoted, so nothing
// here needs GITPATH's decoder; the changed-file cards above, which read porcelain, do.
//
// Two rules this cache exists to keep, both of them about the 3s board repaint:
//   · it is fetched ONCE per working directory, never from the repaint loop. /api/sessions at 2s
//     is what data-saver.md had to shrink; a subprocess per board render would put it back.
//   · what the reader has OPENED is module state, not DOM state, so a repaint cannot fold the
//     tree shut under their hands. Same reason `agentsOpen` and the picker's `pkdOpen` are.
//
// Everything the reader has DONE to this card is keyed BY CWD, and that is the third rule. The
// open-folder set used to be one global Set of `"a/b"` prefixes: two repos that both have a `src/`
// shared its state, so opening `src` in one pane silently opened it in the other — a repaint then
// presented one repo's shape as the other's. Search text, scroll offset and the picked file are
// per-cwd for the same reason.
interface TreeInfo { root: string; files: string[]; total: number; capped: boolean }
const fxTree = new Map<string, TreeInfo | { error: string }>(); // keyed by the slot's cwd
const fxAsked = new Set<string>();  // the latch: one fetch per cwd, retried only by ⟳
const fxOpen = new Map<string, Set<string>>();   // cwd → directories expanded, as "a/b" prefixes
const fxQuery = new Map<string, string>();       // cwd → the card's search text
const fxScroll = new Map<string, number>();      // cwd → the card tree's scroll offset
let fxShell: Shell | null = null;
// The card's search box is REBUILT by every 3s repaint (renderBoard replaceChildren's the whole
// board), so surviving the refresh cannot mean "keep the element" — the element is gone. It means
// restoring what the reader could lose: the text, the caret, and the focus.
//
// Whether it WAS focused is asked of the document, at build time, against the node the previous
// pass left behind — deliberately not tracked with a focus/blur flag. Removing a focused element
// fires blur, and engines are not agreed on whether that lands before or after the restore below;
// a blur arriving late would clear a flag the restore had just re-set, and the box would then lose
// focus on the SECOND refresh rather than the first — the worst kind of intermittent.
const fxInputEl = new Map<string, HTMLInputElement>();
// Restoring focus and scroll has to happen AFTER the board has committed its new nodes: until
// `boardBody.replaceChildren(...)` runs, the card this built is not in the document, and .focus()
// on a detached node is a silent no-op. A microtask is not good enough — renderBoard is async, so
// one can land between the build and the commit. renderBoard calls this at the commit point.
let fxAfterPaint: (() => void) | null = null;
function fxRestoreAfterPaint(): void {
  const fn = fxAfterPaint;
  fxAfterPaint = null;
  fn?.();
}
const fxOpenSet = (cwd: string): Set<string> => {
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
}
function paintTree(into: HTMLElement, root: TreeNode, o: PaintOpts): void {
  // Folding repaints this container, which DETACHES the row that was just activated — so a reader
  // who opened a folder with Enter lost the keyboard entirely, and the next Tab started from the
  // top of the page. The row is rebuilt with the same `rel`, so focus is handed back to it.
  let wantFocus: string | null = null;
  const takeFocus = (rel: string, row: HTMLElement) => {
    if (wantFocus !== rel) return;
    wantFocus = null;
    row.focus();
  };
  const redraw = () => { into.replaceChildren(); const rows: ShellRow[] = []; walk(rows); o.onRows?.(rows); };
  const fileRow = (rel: string, name: string, depth: number, rows: ShellRow[]) => {
    const row = el("button", `fxrow fxfile${o.picked() === rel ? " fxpicked" : ""}`) as HTMLButtonElement;
    row.style.paddingLeft = `${depth * 12 + 12}px`;
    row.appendChild(el("span", "fxname", name));
    row.title = rel;
    const act = () => { o.onPick(rel); redraw(); };
    row.onclick = act;
    into.appendChild(row);
    rows.push({ el: row, open: act });
  };
  const walkTree = (node: TreeNode, prefix: string, depth: number, rows: ShellRow[]): void => {
    for (const [name, kid] of Array.from(node.dirs.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const rel = prefix ? `${prefix}/${name}` : name;
      const open = o.open.has(rel);
      const row = el("button", `fxrow fxdir${open ? " fxopen" : ""}`) as HTMLButtonElement;
      row.style.paddingLeft = `${depth * 12}px`;
      row.appendChild(el("span", "fxtwist", open ? "▾" : "▸"));
      row.appendChild(el("span", "fxname", name));
      row.title = `${rel}/ — ${open ? "collapse" : "expand"}`;
      row.setAttribute("aria-expanded", open ? "true" : "false");
      const act = () => { if (open) o.open.delete(rel); else o.open.add(rel); wantFocus = rel; redraw(); };
      row.onclick = act;
      into.appendChild(row);
      takeFocus(rel, row);
      rows.push({ el: row, open: act });
      if (open) walkTree(kid, rel, depth + 1, rows);
    }
    for (const name of node.files.slice().sort((a, b) => a.localeCompare(b))) {
      fileRow(prefix ? `${prefix}/${name}` : name, name, depth, rows);
    }
  };
  const walk = (rows: ShellRow[]): void => {
    const q = (o.query ?? "").trim();
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
    for (const rel of hits) {
      const row = el("button", `fxrow fxfile fxhit${o.picked() === rel ? " fxpicked" : ""}`) as HTMLButtonElement;
      const cut = rel.lastIndexOf("/");
      if (cut >= 0) row.appendChild(el("span", "fxdim", `${rel.slice(0, cut)}/`));
      row.appendChild(el("span", "fxname", cut >= 0 ? rel.slice(cut + 1) : rel));
      row.title = rel;
      const act = () => { o.onPick(rel); redraw(); };
      row.onclick = act;
      into.appendChild(row);
      rows.push({ el: row, open: act });
    }
    if (o.capped) into.appendChild(el("div", "bempty",
      `${hits.length} match${hits.length === 1 ? "" : "es"} — searched only the first ${o.shown ?? 0}`
      + ` of ${o.total ?? 0} tracked files the server delivered`));
  };
  redraw();
}
async function loadTree(slot: number, cwd: string): Promise<void> {
  const res = await api(`/api/tree?slot=${slot}`).catch(() => null);
  if (res?.ok) {
    const d = (await res.json().catch(() => null)) as TreeInfo | null;
    fxTree.set(cwd, d ?? { error: "the server's answer was not readable JSON" });
  } else {
    const e = res ? ((await res.json().catch(() => null)) as { error?: string } | null) : null;
    fxTree.set(cwd, { error: e?.error ?? "the file tree could not be read" });
  }
  void renderBoard();
}

// The search box, built the same way for the card and for the window. It is one function because
// the two must agree about what a query IS — a filter that means different things in the two
// places would make the window's answer an unreliable check on the card's.
function fxSearchInput(cwd: string, onInput: () => void, wide: boolean): HTMLInputElement {
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
function fileTreeSection(slot: number, cwd: string): HTMLElement {
  const sec = el("div", "bsec");
  const hd = el("div", "bwthead");
  hd.appendChild(el("h3", "", "files in this repo"));
  const t = fxTree.get(cwd);
  if (t && !("error" in t)) {
    const big = el("button", "bwtact", "⤢");
    big.title = "open the file explorer in a window — the place to actually read one";
    big.onclick = () => openExplorer(slot, cwd);
    hd.appendChild(big);
    const again = el("button", "bwtact", "⟳");
    again.title = "re-read the tree (a new file only appears after this)";
    again.onclick = () => { fxTree.delete(cwd); void loadTree(slot, cwd); };
    hd.appendChild(again);
  }
  sec.appendChild(hd);
  if (!t) {
    // the latch: one fetch per working directory, so the 3s repaint that draws this card cannot
    // turn a `git ls-files` into a poll
    if (!fxAsked.has(cwd)) { fxAsked.add(cwd); void loadTree(slot, cwd); }
    sec.appendChild(el("div", "bempty", "reading the file tree…"));
    return sec;
  }
  if ("error" in t) { sec.appendChild(el("div", "bempty", t.error)); return sec; }
  if (!t.total) {
    sec.appendChild(el("div", "bempty",
      "this repository tracks no files yet — `git ls-files` is empty, so there is nothing to list"));
    return sec;
  }
  sec.appendChild(el("div", "bstate", `${t.total} tracked file${t.total === 1 ? "" : "s"}`
    + (t.capped ? ` · showing the first ${t.files.length}` : "")));
  const box = el("div", "fxtree");
  // the box this pass REPLACES — the only place the caret and the focus still exist
  const prev = fxInputEl.get(cwd);
  const refocus = !!prev && document.activeElement === prev;
  const caret = prev ? (prev.selectionStart ?? prev.value.length) : 0;
  const inp = fxSearchInput(cwd, () => repaint(), false);
  fxInputEl.set(cwd, inp);
  sec.appendChild(inp);
  const repaint = () => paintTree(box, treeOf(t.files), {
    open: fxOpenSet(cwd),
    onPick: (rel) => openExplorer(slot, cwd, rel),
    picked: () => null,
    query: fxQuery.get(cwd) ?? "",
    all: t.files, capped: t.capped, shown: t.files.length, total: t.total,
  });
  repaint();
  // the 3s repaint discards this element and builds a new one, so the offset has to be carried in
  // module state and re-applied; without it the card silently jumped to the top every three seconds
  box.onscroll = () => { fxScroll.set(cwd, box.scrollTop); };
  const y = fxScroll.get(cwd) ?? 0;
  fxAfterPaint = () => {
    if (y) box.scrollTop = y;
    if (refocus) { inp.focus(); inp.setSelectionRange(caret, caret); }
  };
  sec.appendChild(box);
  return sec;
}

// The explorer window. It is the same shell every other browse-and-inspect surface uses, and the
// detail pane is showFileView — the viewer the diff window, the picker and the commit lens already
// share. F5 adds an ENTRY POINT to that stair, not a second file view.
function openExplorer(slot: number, cwd: string, startAt?: string) {
  const t = fxTree.get(cwd);
  if (!t || "error" in t) return;
  fxShell?.close();
  let picked: string | null = null;
  const shell = openShell({
    id: "files",
    title: "Files",
    // TREE_CAP is a property of the ANSWER, not of the card that first showed it: the window is
    // where the reader searches, so it is the window that most needs to say the list is partial.
    subtitle: `${baseName(cwd)} · ${t.total} tracked`
      + (t.capped ? ` · only the first ${t.files.length} were sent` : ""),
    detailHint: "Pick a file on the left. Reading is all it does until you press ✎.",
    listWidth: 340,
    onClose: () => { fxShell = null; },
  });
  fxShell = shell;
  // the path of what is open, above the list — a basename in the header is not an answer to
  // "which of the four files called index.ts am I reading"
  const path = el("div", "fxpath", "");
  const open = (rel: string) => {
    picked = rel;
    path.textContent = rel;
    showFileView(shell, {
      path: `${cwd}/${rel}`,
      label: rel.split("/").pop() ?? rel,
      source: "as it is on disk right now",
      edit: { slot },
      back: { label: "the tree", go: () => {
        picked = null;
        path.textContent = "";
        shell.setCloseGuard(null);
        shell.detail.replaceChildren(el("div", "shellhint", "Pick a file on the left."));
        repaint();
      } },
    });
    repaint();
  };
  const repaint = () => paintTree(shell.list, treeOf(t.files), {
    open: fxOpenSet(cwd),
    onPick: open,
    picked: () => picked,
    query: fxQuery.get(cwd) ?? "",
    all: t.files, capped: t.capped, shown: t.files.length, total: t.total,
    // ↑↓ walk the rows and Enter opens the selected one — the same keyboard contract every other
    // window here has. Without it this list was mouse-only, alone among the four.
    onRows: (rows) => {
      shell.setRows(rows);
      // clicking a row also moves the shell's cursor there, so Enter afterwards means "this row"
      for (const [i, r] of rows.entries()) r.el.onfocus = () => shell.select(i, false, false);
    },
  });
  shell.tools.appendChild(fxSearchInput(cwd, repaint, true));
  shell.tools.appendChild(path);
  repaint();
  if (startAt) open(startAt);
}


let boardAgain = false;
async function renderBoard() {
  // a render requested while one is in flight (e.g. focus moved mid-fetch) must not be
  // dropped — remember it and re-run once the current pass finishes
  if (boardBusy) { boardAgain = true; return; }
  if (!boardOpen || isMobile()) return;
  boardBusy = true;
  try {
    const slot = panes[focused]?.slot;
    const s = slot ? fleet[slot - 1] : undefined;
    if (!slot || !s?.cwd) {
      // the gate line is about the MACHINE, not the focused lane — it must not disappear just
      // because the pane under the cursor is empty.
      const gt = gateSection();
      const dp = deploySection();
      const er = errorsSection();
      // ...and so is the device register: which machines can take work is a fact about the room,
      // not about the empty pane.
      const dv = devicesSection();
      boardBody.replaceChildren(...(dp ? [dp] : []), ...(er ? [er] : []), ...(gt ? [gt] : []),
        ...(dv ? [dv] : []), el("div", "bempty", "no session in the focused pane"));
      return;
    }
    const [briefRes, prompts, wtRes, mgRes] = await Promise.all([
      api(`/api/slots/${slot}/brief`), pollOutline(slot),
      s.git ? api(`/api/slots/${slot}/worktrees`) : Promise.resolve(null),
      s.worktree ? api(`/api/slots/${slot}/merge`) : Promise.resolve(null),
    ]);
    const brief = briefRes.ok ? ((await briefRes.json()) as BriefInfo) : null;
    const wts = wtRes?.ok ? ((await wtRes.json()) as WtInfo) : null;
    const mg = mgRes?.ok ? ((await mgRes.json()) as MergeState) : null;
    if (mg?.running) mergeWatch.add(slot);
    const nodes: HTMLElement[] = [];
    // the right board tells ONE story, in the owner's order (§F4, 2026-08-06): IDENTITY →
    // TO LAND → COMMITS → FILES → EXPLORER → LANES → AGENTS → OUTLINE. It runs from "what is
    // pending" through "what is already done" to "what else exists" — so the freshest thing
    // is always at the top and the advisory agents, folded, are at the bottom. Every function
    // of the old flat list is kept, only regrouped.

    // 0 — GATE: machine-level, above the lane story on the owner's call (2026-08-04) because it
    // answers "can anything verify right now" before any question about THIS lane is worth asking.
    // Absent entirely when no suite holds the mutex and no lane has reported — no chrome for the
    // quiet case, same rule the post-land alarm follows.
    // above even the gate line: "can anything verify right now" matters less than "is what you are
    // looking at even the code that is running". Absent entirely unless something is due.
    const dsec0 = deploySection();
    if (dsec0) nodes.push(dsec0);
    // between the two on purpose: "is the running code the code you think" comes first, then
    // "has that code been throwing", and only then "can anything verify right now".
    const esec0 = errorsSection();
    if (esec0) nodes.push(esec0);
    const gsec0 = gateSection();
    if (gsec0) nodes.push(gsec0);
    // last of the machine-level group and below the gate line, in the same order those three read:
    // "is the running code the code you think" → "has it been throwing" → "can anything verify
    // right now" → "and who else could verify it for you".
    const dsec1 = devicesSection();
    if (dsec1) nodes.push(dsec1);

    // 1 — IDENTITY: which lane this is, how to reach it, session-level actions
    const idsec = el("div", "bsec");
    idsec.appendChild(el("h3", "", "identity"));
    idsec.appendChild(el("div", "bidhead", `slot ${slot} · ${s.label ?? baseName(s.cwd)}`));
    if (brief?.branch) {
      const b = el("div", "bstate");
      b.appendChild(el("span", "bbranch", brief.branch));
      // the commit the tree actually sits on. A branch name says WHICH lane, not WHERE it is —
      // and this is the one number you paste into a terminal to check anything by hand.
      if (brief.head) {
        b.appendChild(document.createTextNode(" · "));
        const h = el("span", "bhead", brief.head);
        h.title = "git HEAD — click to copy";
        const sha = brief.head;
        h.onclick = () => { copyText(sha); h.textContent = "copied"; setTimeout(() => { h.textContent = sha; }, 1200); };
        b.appendChild(h);
      }
      b.appendChild(document.createTextNode(brief.worktree ? " · fleet lane" : " · repo session"));
      // live working/idle state — the same signal as the sidebar dot, so you can see BEFORE
      // reaching for commit whether the session is mid-run (re-rendered every 3s)
      const working = sessionActive(slot);
      b.appendChild(el("span", "bwork" + (working ? " on" : ""), working ? " · ● working" : " · ○ idle"));
      idsec.appendChild(b);
      if (brief.sessionStart) idsec.appendChild(el("div", "bidmeta",
        `session since ${new Date(brief.sessionStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`));
      // one-click copy of the worktree path — the one thing you need when you do reach for
      // a terminal in a lane, and it's long and buried otherwise
      if (brief.worktree && s.cwd) {
        const cwd = s.cwd;
        const cp = el("button", "bbtn subtle", "⧉ copy worktree path") as HTMLButtonElement;
        cp.onclick = () => { copyText(cwd); cp.textContent = "✓ copied"; setTimeout(() => { cp.textContent = "⧉ copy worktree path"; }, 1200); };
        idsec.appendChild(cp);
      }
    }
    // session-level actions — labeled controls (were hover-only glyphs unreachable on touch)
    {
      const arow = el("div", "bbtnrow");
      const shrb = el("button", "bbtn" + (s.share ? " on" : ""),
        s.share ? "⤴ shared — view only" : "⤴ share") as HTMLButtonElement;
      shrb.onclick = () => openShareDlg(slot);
      const expb = el("button", "bbtn", "⇩ export") as HTMLButtonElement;
      expb.title = "export session — print / save as PDF";
      expb.onclick = () => window.open(`/api/slots/${slot}/export`, "_blank");
      const renb = el("button", "bbtn", "✎ rename") as HTMLButtonElement;
      renb.onclick = () => {
        const row = slotsEl.querySelector(`[data-slot="${slot}"]`);
        if (row instanceof HTMLElement) startRename(row, s);
      };
      // ↻ bring session back — the repair for a pane that switched conversations on you.
      // Claude Code can change session IN-PROCESS: the pane keeps the argv it was spawned with,
      // so nothing on the outside can tell, and Escape does not undo it. A respawn does, because
      // the slot still holds the pinned sessionId and the server restarts the pane with --resume.
      // Always shown on an active slot: there is no deterministic signal for "this pane wandered
      // off" (the one candidate, "the pinned transcript is not growing", fires on any long tool
      // call), so the owner decides, not a detector.
      const rsb = el("button", "bbtn", "↻ bring session back") as HTMLButtonElement;
      rsb.title = "restart this pane and resume the pinned conversation — the slot keeps its lane, "
        + "label, model, shares and scheduled prompts. Whatever the session is doing RIGHT NOW is lost.";
      rsb.onclick = async () => {
        if (!confirm(`Restart slot ${slot}'s pane and resume the pinned conversation?\n\n`
          + "Nothing about the slot is thrown away. But claude is killed, so anything it is doing "
          + "right now — a running tool call, unsent output — is lost.")) return;
        rsb.disabled = true;
        rsb.textContent = "… restarting";
        const r = await post(`/api/slots/${slot}/restart`, {});
        const j = await r.json().catch(() => null) as { resumed?: boolean; error?: string } | null;
        if (!r.ok) { alert(j?.error ?? "restart failed"); rsb.disabled = false; rsb.textContent = "↻ bring session back"; return; }
        // say which of the two happened rather than a uniform tick: "restarted fresh" means the
        // pinned conversation could NOT be resumed (no pin, or its transcript is gone), and that
        // is the one outcome the owner must not mistake for success
        rsb.textContent = j?.resumed ? "✓ session back" : "⚠ restarted fresh";
        setTimeout(() => { rsb.disabled = false; rsb.textContent = "↻ bring session back"; }, 2500);
        await refresh();
      };
      arow.append(shrb, expb, renb, rsb);
      idsec.appendChild(arow);
    }
    nodes.push(idsec);

    if (brief) {
      // for a lane, ahead/behind are vs the base branch (from the brief); for a non-lane
      // session, vs the upstream (from the sessions-poll gitInfo)
      const ahead = brief.laneScoped ? brief.ahead : (s.git?.ahead ?? 0);
      const behind = brief.laneScoped ? brief.behind : (s.git?.behind ?? 0);

      // 2 — TO LAND: everything between "written" and "in main" — the uncommitted tree, the SAVE
      // button, and (on a lane) the land action itself. Split out of the old WORK section on the
      // owner's order (§F4, briefs/ui-next-level-2026-08-06.md): what is still PENDING comes
      // before the history of what is already done, and commits/files below are that history.
      const work = el("div", "bsec");
      work.appendChild(el("h3", "", brief.worktree ? "to land" : "work"));
      // an interrupted rebase/merge (e.g. a deploy that killed the server mid-land) wedges
      // commit + land here — surface it as an explicit, fixable state, not a silent refusal
      if (brief.gitOp) {
        const warn = el("div", "bgitop",
          "⚠ a git merge/rebase is in progress — finish or abort it in this session's terminal (git rebase --abort / git merge --abort), then retry. Commit & land are blocked until then.");
        work.appendChild(warn);
      }
      if (brief.uncommitted) {
        const wl = el("div", "bstate");
        wl.appendChild(el("span", "editing",
          `${brief.uncommitted} uncommitted file${brief.uncommitted === 1 ? "" : "s"}`));
        work.appendChild(wl);
        // the concrete uncommitted work — exactly what git status shows, with its codes
        if (brief.uncommittedFiles.length) {
          const uf = el("div", "bunc");
          for (const f of brief.uncommittedFiles.slice(0, 40)) {
            // porcelain XY: X = staged (index) column, Y = worktree (unstaged) column
            const x = f[0] ?? " ", y = f[1] ?? " ";
            const row = el("div", "buncf");
            // untracked → new; anything staged (X set, not '?') → staged; else unstaged-only → mod
            const cls = f.startsWith("??") ? "new" : x !== " " ? "staged" : "mod";
            const badge = el("span", `buncst ${cls}`, f.startsWith("??") ? "?" : f.slice(0, 2).trim() || "M");
            // untracked FIRST: porcelain sets both columns to '?', so every x/y test below
            // matches it — asking them first labelled a new file "staged + unstaged changes"
            badge.title = f.startsWith("??") ? "untracked"
              : x !== " " && y !== " " ? "staged + unstaged changes"
              : x !== " " ? "staged" : "unstaged changes";
            row.appendChild(badge);
            row.appendChild(document.createTextNode(f.slice(3)));
            // as with the committed list below: every row here opened the WHOLE working diff,
            // whichever row you clicked. Now it opens the review window on this file — and an
            // UNTRACKED file has no diff to open on, so it goes straight to the file itself.
            const upath = porcelainPath(f);
            const untracked = f.startsWith("??");
            row.title = untracked ? `${f} — click to read it (untracked: there is no diff yet)`
              : `${f} — click to see what changed in this file`;
            row.onclick = () => void openReview(slot, "working",
              untracked ? { k: "untracked", path: upath } : { k: "file", path: upath });
            uf.appendChild(row);
          }
          if (brief.uncommittedFiles.length > 40)
            uf.appendChild(el("div", "bempty", `… ${brief.uncommittedFiles.length - 40} more`));
          work.appendChild(uf);
        }
        // the SAVE — lanes only. land/merge refuse a dirty tree; this commits so a kill can't
        // lose the work. quick = deterministic wip; agent = an agent writes the message.
        if (brief.worktree) {
          const busy = commitBusy.get(slot);
          const crow = el("div", "bbtnrow");
          // ONE commit here — the safety net: instant wip commit so a kill can't lose the
          // work (saved locally, never pushed/landed, reversible with git reset). The
          // agent-written-message path moved to land time — ⏏ land now commits-if-dirty
          // with an agent message — so there's no separate "✎ message" affordance on a lane.
          const q = el("button", "bbtn amber", busy === "quick" ? "… saving" : "commit") as HTMLButtonElement;
          q.disabled = !!busy; // also disabled mid-land, while doLand's commit-if-dirty runs (busy === "agent")
          q.title = "commit all uncommitted work now so a kill can't lose it — saved locally, never pushed or landed (undo with git reset)";
          q.onclick = () => void doCommit(slot, "quick");
          crow.append(q);
          work.appendChild(crow);
        } else {
          // main (non-lane) session: commit TRACKED changes (add -u) with a staging preview,
          // so the owner sees exactly what lands on a branch they ship and that untracked
          // files are left alone. Reversible (git reset); the server never pushes.
          const busy = commitBusy.get(slot);
          const files = brief.uncommittedFiles;
          const crow = el("div", "bbtnrow");
          // same one-action-plus-refinement as a lane. On a MAIN checkout the preview shows
          // that only tracked changes (git add -u) are staged — untracked files are left
          // alone. No separate diff button here: the file rows above are already click-to-diff.
          const q = el("button", "bbtn amber", busy === "quick" ? "… saving" : "commit") as HTMLButtonElement;
          q.disabled = !!busy;
          q.title = "stage & commit tracked changes only (git add -u); untracked files left alone — undo with git reset. Shows a preview first.";
          q.onclick = () => void doCommitMain(slot, "quick", files);
          const a = el("button", "bbtn amber ghost", busy === "agent" ? "… writing message" : "✎ message") as HTMLButtonElement;
          a.disabled = !!busy;
          a.title = "same commit, but a short-lived agent writes a conventional-commit message from the staged diff first";
          a.onclick = () => void doCommitMain(slot, "agent", files);
          crow.append(q, a);
          work.appendChild(crow);
        }
      } else if (ahead) {
        work.appendChild(el("div", "bnote ready",
          `${ahead} commit${ahead === 1 ? "" : "s"} ready to ${brief.worktree ? "land ↓" : "push"}`));
      } else {
        work.appendChild(el("div", "bnote", "working tree clean — nothing to save"));
        if (!brief.worktree) {
          const db = el("button", "bbtn", "± view diff") as HTMLButtonElement;
          db.onclick = () => void openDiff(slot);
          work.appendChild(db);
        }
      }
      if (behind && brief.laneScoped)
        work.appendChild(el("div", "bnote", `↓${behind} behind ${brief.laneBase ?? "main"}`));
      // the lane's endgame, in the same section because it is the same subject: ONE land action
      // whose label carries the auto-vs-review-needed distinction as text. doLand tries the direct
      // /land path, then falls back to the /merge agent — the UI is collapsed to one control.
      if (brief.worktree) {
        const land = el("div", "blandacts");
        const l = !mg?.running && mg?.last && mg.last.branch === brief.worktree.branch ? mg.last : null;
        // an INTERRUPTED run that had already handed the conflicts to the agent needs the same
        // eye as a settled "resolved" verdict: the resolutions may be committed in the lane and
        // nobody — not even the server — ever saw a verdict for them (server.ts, needsMergeReview)
        const awaitingReview = l?.status === "resolved"
          || (l?.status === "interrupted" && (l.conflicted?.length ?? 0) > 0);
        // no standalone "± view diff" here: it opened the same working diff (openDiff) already
        // reachable by clicking a file row in WORK — a second button for an identical source.
        // The working diff lives on the file rows (one consistent affordance); the resolved
        // main..HEAD diff lives on the review note's "± review diff" below. Two sources, not
        // three competing buttons — so each land state shows one obvious review control.
        // one land verb on screen at a time. Normally this IS the land. In the review state
        // the note owns "⏏ land", so this becomes the distinct "re-run" action (only needed
        // if main moved) — never a second, competing land button. Green = "ready to land".
        // …unless this fleet does not land at all (FLEET_LANDS=0). Then the verb is not disabled
        // but ABSENT: a greyed-out control still says "this is the thing you would do here", and on
        // a follower instance it is not. ⇲ shelve stays — setting a lane aside is local, and it is
        // the exit that remains when landing is somebody else's host. Visibility only: the server's
        // 409 is the guarantee, this is the board declining to offer a gesture it knows is refused.
        if (landsEnabled) {
          const lb = el("button", "bbtn" + (ahead && !mg?.running && !awaitingReview ? " green" : ""),
            mg?.running ? "… landing" : awaitingReview ? "↻ re-run merge" : "⏏ land lane") as HTMLButtonElement;
          lb.disabled = !!mg?.running;
          lb.title = awaitingReview
            ? "re-run the merge from scratch — only needed if main moved since these conflicts were resolved"
            : "already-merged lanes land immediately; otherwise this rebases onto main and lands "
              + "automatically — on conflicts a background agent resolves them and pauses for your review "
              + "before anything reaches main";
          lb.onclick = () => void doLand(slot);
          land.appendChild(lb);
        } else {
          land.appendChild(el("div", "bmergedetail",
            "this fleet follows a canonical main and does not land — land this branch on the canonical host"));
        }
        // ⇲ shelve — the safe third exit beside land: set aside WITH a note, keep the worktree.
        const shb = el("button", "bbtn", "⇲ shelve") as HTMLButtonElement;
        shb.disabled = !!mg?.running;
        shb.title = "set this lane aside with a note (what's left) — kills the slot, keeps the worktree to resume later; nothing lost, nothing destroyed";
        shb.onclick = () => void doShelve(slot);
        land.appendChild(shb);
        // ↩ undo last land — only when the server still holds an undoable land for THIS repo
        // (main not moved since, not pushed). Reverses the one action that mutates main.
        if (mg?.undoable && brief.worktree.repo) {
          const ub = el("button", "bbtn", `↩ undo last land (${mg.undoable.branch.replace(/^fleet\//, "")})`) as HTMLButtonElement;
          ub.disabled = !!mg?.running;
          ub.title = "reset main back to before the last land in this repo — refuses if main moved since or the commit was pushed; the landed branch is kept, so the work is recoverable either way";
          const repo = brief.worktree.repo;
          const landedBranch = mg.undoable.branch;
          ub.onclick = () => void doUndoLand(repo, landedBranch);
          land.appendChild(ub);
        }
        if (awaitingReview && l) {
          // the agent resolved conflicts and the server verified the rebase — the owner
          // reviews the diff and lands. This is the one place a human eye is required.
          const n = l.conflicted?.length ?? 0;
          const note = el("div", "bmergenote review");
          const hd = el("div", "bmergehd", l.status === "interrupted"
            ? `merge INTERRUPTED while resolving${n ? ` ${n} file${n === 1 ? "" : "s"}` : ""} — no verdict was ever recorded; review, then land `
            : `conflicts resolved${n ? ` in ${n} file${n === 1 ? "" : "s"}` : ""} — review, then land `);
          hd.appendChild(verifyBadge(l.verify));
          note.appendChild(hd);
          if (l.conflicted?.length) note.appendChild(el("div", "bmergefiles", l.conflicted.join(", ")));
          note.appendChild(el("div", "bmergedetail", l.detail));
          const acts = el("div", "bmergeacts");
          const rev = el("button", "bmergereview", "± review diff") as HTMLButtonElement;
          rev.onclick = () => void openMergeDiff(slot);
          acts.append(rev);
          // reviewing a carried-over verdict stays available on a follower; confirming it does not.
          if (landsEnabled) {
            const landb = el("button", "bmergeland", "⏏ land") as HTMLButtonElement;
            landb.onclick = () => void doMergeLand(slot);
            acts.append(landb);
          }
          note.appendChild(acts);
          land.appendChild(note);
        } else if (l) {
          // "awaiting-author" is a WAIT, not a failure: the lane's own session is resolving its own
          // conflict right now. Rendering it in the error style (the fall-through default for every
          // non-merged/non-blocked status) would read as "the merge broke" on the one path that is
          // working exactly as designed.
          const cls = (l.status === "merged" && l.landed) || l.status === "awaiting-author" ? "ok"
            : l.status === "blocked" ? "warn" : "err";
          const vn = el("div", `bmergenote ${cls}`,
            `${l.status === "merged" ? (l.landed ? "merged + landed" : "merged, NOT landed")
              : l.status === "awaiting-author" ? "the lane's own session is resolving this conflict" : l.status}: ${l.detail} `);
          vn.appendChild(verifyBadge(l.verify));
          land.appendChild(vn);
        }
        work.appendChild(land);
      }
      nodes.push(work);

      // 3 — COMMITS: the history, and deliberately TWO lists ("vllt beides", owner §F4) — what
      // this lane/session added, and what the project got around it. The second list is empty
      // whenever it would merely repeat the first (server: repoRecentCommits).
      //
      // Both lists are CLICKABLE, and each opens the lens whose route can actually serve it — the
      // two are not interchangeable, which is why this takes a `where` instead of guessing.
      // Measured 2026-08-20 against a live server, real requests, real status codes:
      //   · a lane commit  → GET /api/slots/:id/commit-diff?hash=…            → 200 + diff + files
      //   · a REPO commit  → the same route                                   → 404 "not a commit
      //     of this slot", and rightly so: that route recomputes slotCommits (base..HEAD) and
      //     checks membership, and the second list is `git log <base>` — disjoint by construction.
      //     GET /api/commit-diff?repo=<worktree.repo>&hash=… serves it 200, and every hash in
      //     the second list was in that route's own list. So: the Commits lens, opened on it.
      // A `<button>` rather than a div with an onclick: Enter/Space, tab focus and the focus ring
      // come with the element, and criterion "no double-click or hover requirement" is then a
      // property of the tag, not of a handler someone has to remember to keep.
      const commitRow = (cm: BriefCommit, where: "session" | "repo") => {
        const row = el("button", "brow") as HTMLButtonElement;
        row.appendChild(el("span", "bhash", cm.hash));
        const sub = el("span", "bsub", cm.subject);
        sub.title = cm.subject; // the row is one line wide; a long subject is only readable on hover
        row.appendChild(sub);
        row.title = where === "session"
          ? `${cm.hash} — open this commit's diff and file list`
          : `${cm.hash} — open this commit in the repo's Commits lens (it is not this session's own commit)`;
        row.onclick = where === "session"
          ? () => void openReview(slot, "working", { k: "commit", hash: cm.hash })
          : () => void openActivity("commits", { repo: repoOfSlot(s, brief), hash: cm.hash });
        return row;
      };
      const csec = el("div", "bsec");
      csec.appendChild(el("h3", "", "commits"));
      csec.appendChild(el("div", "bsubhead", brief.laneScoped ? `on this lane (vs ${brief.laneBase ?? "main"})`
        : brief.sessionStart ? "this session" : "recent"));
      if (!brief.commits.length) csec.appendChild(el("div", "bempty",
        brief.laneScoped ? `no commits yet — even with ${brief.laneBase ?? "main"}` : "no commits this session yet"));
      for (const cm of brief.commits) csec.appendChild(commitRow(cm, "session"));
      if (brief.repoCommits.length) {
        csec.appendChild(el("div", "bsubhead", brief.laneScoped
          ? `already in ${brief.laneBase ?? "main"}` : "earlier in this repo"));
        for (const cm of brief.repoCommits) csec.appendChild(commitRow(cm, "repo"));
      }
      nodes.push(csec);

      // 4 — FILES: the committed footprint — what this lane/session changes vs its base.
      if (brief.files.length) {
        const fsec = el("div", "bsec");
        fsec.appendChild(el("h3", "", brief.laneScoped ? `files changed vs ${brief.laneBase ?? "main"}`
          : brief.sessionStart ? "files changed this session" : "changed files"));
        if (brief.shortstat) fsec.appendChild(el("div", "bstate", brief.shortstat));
        for (const f of brief.files.slice(0, 30)) {
          const row = el("div", "bfile");
          row.appendChild(el("span", "bfst", f.slice(0, 2).trim() || "·"));
          row.appendChild(document.createTextNode(f.slice(3)));
          // every row here used to open the WHOLE working diff, whichever row you clicked — the
          // card listed thirty files and answered the same way for all of them. It now opens the
          // review window ON the file you clicked. `f` is porcelain ("M  path"), so the path
          // starts at column 3.
          const path = porcelainPath(f);
          row.title = `${f} — click to see what changed in this file`;
          row.onclick = () => void openReview(slot, "working", { k: "file", path });
          fsec.appendChild(row);
        }
        if (brief.files.length > 30) fsec.appendChild(el("div", "bempty", `… ${brief.files.length - 30} more`));
        nodes.push(fsec);
      }

      // 5 — EXPLORER: the repo's whole file tree, not just what changed. The card above answers
      // "what did this session touch"; this one answers "what is in here", which is the question
      // you have when you are reading rather than reviewing. Same destination either way — one
      // click opens the file view both cards already use.
      // Drawn only where there is a branch: the tree is `git ls-files`, so a session opened on a
      // plain directory would get a card whose only content is "not a git repo" on every repaint.
      // A detached HEAD loses the card too — the honest cost of reading git-ness off the one field
      // the brief already carries, rather than adding a probe to the 3s render for an edge case.
      if (brief.branch) nodes.push(fileTreeSection(slot, s.cwd));

      // 6 — LANES: the repo's lane map — every open worktree, who holds it, its state, and
      // the orphans (killed slot, worktree still on disk) with reattach/remove/discard +
      // ＋ new lane.
      if (wts) {
        const sec = el("div", "bsec");
        const hd = el("div", "bwthead");
        hd.appendChild(el("h3", "", `lanes — ${baseName(wts.repo)} · main: ${wts.main}`));
        sec.appendChild(hd);
        if (!wts.worktrees.length) sec.appendChild(el("div", "bempty", "no open lanes in this repo"));
        for (const w of wts.worktrees) {
          const row = el("div", "bwt");
          row.appendChild(el("span", "lanechip", "⎇"));
          // fleet branches share a ~16-char prefix (`fleet/260806142…`) and differ only at the
          // end, so an end-ellipsis cut two distinct lanes down to the SAME string. Split the
          // name into a head that shrinks and a tail that never does. The tail is the last
          // `-`/`/` segment, capped at 12 chars so a long separator-less name can't grow into
          // an unshrinkable block that pushes the state and buttons out of the row.
          const sep = Math.max(w.branch.lastIndexOf("-"), w.branch.lastIndexOf("/")) + 1;
          const tail = w.branch.slice(Math.max(sep, w.branch.length - 12));
          const b = el("span", "bwtbr");
          b.appendChild(el("span", "bwtbrh", w.branch.slice(0, w.branch.length - tail.length)));
          b.appendChild(el("span", "bwtbrt", tail));
          b.title = w.path;
          row.appendChild(b);
          const state = w.dirty ? "editing" : w.ahead ? "ready" : "clean";
          const parts: string[] = [];
          if (w.dirty) parts.push(`•${w.dirty}`);
          if (w.ahead) parts.push(`↑${w.ahead}`);
          if (w.behind) parts.push(`↓${w.behind}`);
          const stateEl = el("span", `bwtstate ${state}`, parts.join(" ") || "=");
          stateEl.title = [
            w.dirty ? `${w.dirty} uncommitted file${w.dirty === 1 ? "" : "s"}` : "working tree clean",
            w.ahead ? `${w.ahead} commit${w.ahead === 1 ? "" : "s"} ahead of ${wts.main}` : "",
            w.behind ? `${w.behind} behind ${wts.main}` : "",
          ].filter(Boolean).join(" · ");
          row.appendChild(stateEl);
          if (w.slot != null) {
            const here = w.slot === slot;
            const chip = el("button", "bwtact", here ? "this slot" : `slot ${w.slot}`) as HTMLButtonElement;
            chip.disabled = here;
            if (!here) {
              const target = w.slot;
              chip.onclick = () => showSlot(target);
            }
            row.appendChild(chip);
          } else {
            const open = el("button", "bwtact", "open") as HTMLButtonElement;
            open.title = "no session holds this worktree — reopen it in a free slot (reviewable/landable again)";
            open.onclick = async () => {
              if (laneReqBusy) return;
              laneReqBusy = true;
              try {
                const r = await post("/api/lanes", { repo: wts.repo, attach: w.path });
                const j = (await r.json().catch(() => ({}))) as { slot?: number; error?: string };
                if (!r.ok) { alert(j.error ?? "open failed"); return; }
                await refresh();
                if (j.slot) showSlot(j.slot);
              } finally {
                laneReqBusy = false;
              }
            };
            row.appendChild(open);
            // one "close" affordance: git state (w.empty) picks the safe default — a clean
            // lane is removed after a light confirm; a lane with unsaved/unmerged work opens
            // the deliberate discard read-window below (destruction stays gated exactly as
            // before). "open" above is the separate, opposite intent (reattach to KEEP it).
            const close = el("button", "bwtact del", "close") as HTMLButtonElement;
            close.title = w.empty
              ? "close this lane — clean worktree, nothing to lose (removes it)"
              : "close this lane — it has unsaved/unmerged work: opens the discard read-window (destroys it). Reattach with ‘open’ to keep it.";
            close.onclick = async () => {
              if (w.empty) {
                const ok = await showRiskPreview(`Close lane ${w.branch}? — clean worktree, nothing to lose`, w, "close");
                if (!ok) return;
                const r = await post("/api/worktrees/remove", { repo: wts.repo, path: w.path });
                if (!r.ok) {
                  const j = (await r.json().catch(() => ({}))) as { error?: string };
                  alert(j.error ?? "close failed");
                }
                void renderBoard();
              } else {
                discardArm = { path: w.path, at: Date.now() }; // deliberate destruction gate (read-window below)
                void renderBoard();
              }
            };
            row.appendChild(close);
          }
          sec.appendChild(row);
          // shelve note: this orphan was set aside with "what's left" — show it so resuming has
          // context (cleared server-side when the lane is reopened, removed, or discarded)
          if (w.note != null) {
            const nrow = el("div", "sweepv shelved");
            nrow.appendChild(el("span", "sweepvbadge", "⇲ shelved"));
            nrow.appendChild(el("span", "sweepvreason", w.note || "(no note)"));
            sec.appendChild(nrow);
          }
          // the confirm panel is not a dialog: the consequences ARE the wait screen. The
          // destructive button unlocks only after the read window, counted from the first
          // click and re-derived on every 3s board re-render, so polling can't reset or
          // skip the gate. Stale arms (>60s) auto-cancel — a forgotten panel must not
          // sit primed forever.
          if (w.slot == null && discardArm?.path === w.path) {
            if (Date.now() - discardArm.at > 60_000) { discardArm = null; continue; }
            const arm = discardArm;
            const box = el("div", "bdiscard");
            box.appendChild(el("div", "bdtitle", `discard ${w.branch}?`));
            if (w.empty) {
              box.appendChild(el("div", "riskempty", "safe — no uncommitted changes, no unpushed commits"));
            } else {
              if (w.dirtyFiles.length) {
                box.appendChild(el("div", "bdline", `${w.dirtyFiles.length} uncommitted file${w.dirtyFiles.length === 1 ? "" : "s"} — DESTROYED, no undo:`));
                for (const f of w.dirtyFiles.slice(0, 15)) box.appendChild(el("div", "riskfile", f));
              } else {
                box.appendChild(el("div", "bdline", "working tree clean — nothing uncommitted to lose"));
              }
              if (w.unpushedCommits.length) {
                box.appendChild(el("div", "bdline", `${w.unpushedCommits.length} unmerged commit${w.unpushedCommits.length === 1 ? "" : "s"} — branch deleted; the undo line appears after:`));
                for (const c of w.unpushedCommits.slice(0, 15)) box.appendChild(el("div", "riskcommit", `${c.hash} ${c.subject}`));
              } else {
                box.appendChild(el("div", "bdline", `no commits beyond ${wts.main} — branch deleted`));
              }
            }
            const cancel = el("button", "bwtact", "cancel") as HTMLButtonElement;
            cancel.onclick = () => { discardArm = null; void renderBoard(); };
            const go = el("button", "bwtact del", "") as HTMLButtonElement;
            const tick = () => {
              const left = Math.ceil((arm.at + DISCARD_READ_MS - Date.now()) / 1000);
              go.disabled = left > 0;
              go.textContent = left > 0 ? `read the above … ${left}` : "☠ discard forever";
            };
            tick();
            const iv = setInterval(() => { if (go.isConnected) tick(); else clearInterval(iv); }, 250);
            go.onclick = async () => {
              if (go.disabled) return;
              go.disabled = true;
              const r = await post("/api/worktrees/discard", { repo: wts.repo, path: w.path, branch: w.branch });
              const j = (await r.json().catch(() => ({}))) as
                { error?: string; branch?: string; head?: string | null };
              discardArm = null;
              if (!r.ok) alert(j.error ?? "discard failed");
              else if (j.head) alert(j.branch === "(detached)"
                ? `lane discarded.\nRecover until git gc from sha:\n  ${j.head}`
                : `lane discarded.\nUndo until git gc:\n  git branch ${j.branch} ${j.head}`);
              void renderBoard();
            };
            const btns = el("div", "bdbtns");
            btns.append(cancel, go);
            box.appendChild(btns);
            sec.appendChild(box);
          }
        }
        const nb = el("button", "bbtn accent", "＋ ⎇ new lane") as HTMLButtonElement;
        nb.title = `fresh worktree lane off ${wts.main}, session opens in the first free slot — one click`;
        nb.onclick = () => { nb.disabled = true; void newLane(wts.repo); };
        sec.appendChild(nb);
        nodes.push(sec);
      }
    }
    if (brief) {
      // 8 — AGENTS: advisory, read-only. ✨ summarize + 🔍 review. Last of the lane story and
      // folded behind "more ▸", closed on every load (owner call §F4): the git story above is
      // what the board is for, and these two were sitting in the middle of it. NOTHING is
      // removed — the ③ auto-review keeps writing the outcome ledger either way; this decides
      // only what the board shows unasked.
      const asec = el("div", "bsec");
      const more = el("button", "bmore",
        `${agentsOpen ? "▾" : "▸"} more — agents (summary · review)`) as HTMLButtonElement;
      more.title = "two advisory, read-only agents over this session: a summary and a code review";
      more.onclick = () => { agentsOpen = !agentsOpen; void renderBoard(); };
      asec.appendChild(more);
      if (agentsOpen) {
        // both cache reads happen on OPEN, not on render: a folded group must not spend two
        // requests per slot on results nobody is looking at (GET never spawns the agent)
        if (!sumCache.has(slot)) {
          sumCache.set(slot, {});
          void api(`/api/slots/${slot}/summary`).then(async (r) => {
            if (!r.ok) return;
            const j = (await r.json()) as SummaryInfo;
            if (j.summary) { sumCache.set(slot, j); void renderBoard(); }
          }).catch(() => { /* transient — the button still works */ });
        }
        // same one-shot cache recovery for the review (GET is a pure cache lookup server-side)
        if (!revCache.has(slot)) {
          revCache.set(slot, {});
          void api(`/api/slots/${slot}/review`).then(async (r) => {
            if (!r.ok) return;
            const j = (await r.json()) as ReviewInfo;
            if (j.findings) { revCache.set(slot, j); void renderBoard(); }
          }).catch(() => { /* transient — the button still works */ });
        }
        // a result is pinned to the git state it was computed on — say so when that state moved on
        const agedOut = (head?: string | null, dirty?: number) => {
          const c0 = brief.commits[0];
          return (!!head && !!c0 && !head.startsWith(c0.hash)) || dirty !== brief.uncommitted;
        };
        asec.appendChild(el("div", "bagenthint", "advisory · read-only — these never change your files"));
        // The summarizer's evidence is the TRANSCRIPT TAIL (server.ts, the "## transcript tail"
        // block). On a harness that writes none, it would still run, still cost a model call, and
        // still answer confidently — from the diff alone, with the conversation silently missing.
        // So it is withdrawn and SAID, rather than offered and quietly degraded.
        //
        // 🔍 review below is deliberately NOT withdrawn: it reads the git diff (reviewContextBlocks
        // takes a cwd, never a Slot), so it is unaffected by the harness. Checked, not assumed —
        // the design note that grouped "✨/🔍" together was written before either was traced.
        const canSum = supportsOf(fleet.find((x) => x.id === slot)?.harness).transcript;
        const sum = sumCache.get(slot);
        if (!canSum)
          asec.appendChild(el("div", "bstale",
            "📋 summary needs a conversation transcript — this session's harness writes none"));
        const sbtn = el("button", "bbtn accent",
          sumBusy.has(slot) ? "… summarizing" : sum?.summary ? "📋 re-summarize" : "📋 summarize") as HTMLButtonElement;
        sbtn.disabled = sumBusy.has(slot) || !canSum;
        sbtn.title = canSum
          ? "run a short-lived read-only agent (background claude session in this checkout, uses the subscription) — one model call"
          : "unavailable: this session's harness writes no transcript for the summarizer to read";
        sbtn.onclick = async () => {
          if (sumBusy.has(slot)) return;
          sumBusy.add(slot);
          sbtn.disabled = true;
          sbtn.textContent = "… summarizing";
          try {
            const r = await post(`/api/slots/${slot}/summary`, {});
            const j = (await r.json().catch(() => ({}))) as SummaryInfo;
            sumCache.set(slot, r.ok ? j : { error: j.error ?? "summarizer failed" });
          } catch {
            sumCache.set(slot, { error: "summarizer failed — network error" });
          } finally {
            sumBusy.delete(slot);
            void renderBoard();
          }
        };
        asec.appendChild(sbtn);
        if (sum?.summary) {
          // visible aging: the summary is pinned to the git state it was computed on
          if (agedOut(sum.head, sum.dirty))
            asec.appendChild(el("div", "bstale", "⚠ computed for an older state — re-run to refresh"));
          asec.appendChild(el("div", "bsum", sum.summary));
          if (sum.openThreads?.length) {
            asec.appendChild(el("div", "bsumhead", "open threads"));
            for (const t of sum.openThreads) asec.appendChild(el("div", "bsumrow", `· ${t}`));
          }
          if (sum.verification) asec.appendChild(el("div", "bsumver", `verified: ${sum.verification}`));
          if (sum.model && sum.at)
            asec.appendChild(el("div", "bsummeta", `${sum.model} · ${new Date(sum.at).toLocaleTimeString()}`));
        } else if (sum?.error) {
          asec.appendChild(el("div", "bsumerr", sum.error));
        }
        // 🔍 review — a SECOND agent beside the summarizer, over this slot's code changes.
        // Advisory only: it never gates or alters a land, a merge or a file.
        const rev = revCache.get(slot);
        const rbtn = el("button", "bbtn accent",
          revBusy.has(slot) ? "… reviewing" : rev?.findings ? "🔍 re-review" : "🔍 review") as HTMLButtonElement;
        rbtn.disabled = revBusy.has(slot);
        rbtn.title = "run a short-lived read-only agent over this session's own code changes — one model call, advisory only";
        rbtn.onclick = async () => {
          if (revBusy.has(slot)) return;
          revBusy.add(slot);
          rbtn.disabled = true;
          rbtn.textContent = "… reviewing";
          try {
            const r = await post(`/api/slots/${slot}/review`, {});
            const j = (await r.json().catch(() => ({}))) as ReviewInfo;
            revCache.set(slot, r.ok ? j : { error: j.error ?? "reviewer failed" });
          } catch {
            revCache.set(slot, { error: "reviewer failed — network error" });
          } finally {
            revBusy.delete(slot);
            void renderBoard();
          }
        };
        asec.appendChild(rbtn);
        if (rev?.findings) {
          if (agedOut(rev.head, rev.dirty))
            asec.appendChild(el("div", "bstale", "⚠ reviewed an older state — re-run to refresh"));
          if (!rev.findings.length) {
            asec.appendChild(el("div", "bsumrow", "· no findings in the reviewed changes"));
          } else {
            asec.appendChild(el("div", "bsumhead", `findings — ${rev.findings.length}, worst first`));
            for (const f of rev.findings) {
              const row = el("div", `bfind ${f.impact}`);
              const hd = el("div", "bfindhd");
              hd.appendChild(el("span", "bfindimp", f.impact));
              hd.appendChild(el("span", "bfindt", f.title || "(untitled)"));
              row.appendChild(hd);
              row.appendChild(el("div", "bfindcite", `${f.file}:${f.line} · ${f.basis}`));
              if (f.detail) row.appendChild(el("div", "bfinddet", f.detail));
              if (f.cost) row.appendChild(el("div", "bfindcost", `cost: ${f.cost}`));
              asec.appendChild(row);
            }
          }
          if (rev.notes) asec.appendChild(el("div", "bsumver", `not checked: ${rev.notes}`));
          if (rev.scope) asec.appendChild(el("div", "bsummeta", rev.scope));
          if (rev.model && rev.at)
            asec.appendChild(el("div", "bsummeta", `${rev.model} · ${new Date(rev.at).toLocaleTimeString()}`));
          // was this review worth anything? One tap, owner-only, joined by patchId (content identity,
          // so the label survives the land-path rebase). A review with no patchId gets no buttons —
          // there is no honest key to file the label under, and a guessed one is worse than none.
          if (rev.patchId) {
            const rref = rev.patchId;
            const rcur = dispoOf("review3", rref);
            const rlab = el("div", "ocdispo-row");
            rlab.appendChild(el("span", "ocdispo-state" + (rcur ? ` is-${rcur}` : " is-none"),
              rcur ? `dein Urteil: ${DISPO_WORD_UI[rcur]}` : "unbewertet"));
            for (const [verdict, word] of [["accepted", "nützlich"], ["wrong", "falsch"]] as [DispositionVerdict, string][]) {
              const b = el("button", `ocdispo-btn${rcur === verdict ? " active" : ""}`, word) as HTMLButtonElement;
              b.title = `label this review — records an owner \`${verdict}\` disposition on the rail`;
              b.onclick = async () => {
                b.disabled = true;
                if (await labelDisposition("review3", rref, verdict)) void renderBoard();
                else b.disabled = false;
              };
              rlab.appendChild(b);
            }
            asec.appendChild(rlab);
          }
        } else if (rev?.error) {
          asec.appendChild(el("div", "bsumerr", rev.error));
        }
      }
      nodes.push(asec);
    }

    // 9 — OUTLINE: prompt-jump navigation, kept at the bottom (lowest priority)
    const psec = el("div", "bsec");
    psec.appendChild(el("h3", "", `your prompts (${prompts.length})`));
    if (!prompts.length) psec.appendChild(el("div", "bempty", "no prompts in the transcript yet"));
    prompts.forEach((p, i) => {
      const row = el("div", "bprompt");
      row.appendChild(el("span", "bn", String(i + 1)));
      const t = el("span", "bt", p);
      t.title = p;
      row.appendChild(t);
      row.onclick = () => panes[focused]?.showPromptAt(i);
      psec.appendChild(row);
    });
    nodes.push(psec);
    // the focus moved to another pane while we were fetching — this render describes
    // the wrong slot; drop it (the re-run below paints the right one)
    if (panes[focused]?.slot !== slot) { boardAgain = true; return; }
    // rebuild in place but keep the reading position
    const y = boardBody.scrollTop;
    boardBody.replaceChildren(...nodes);
    boardBody.scrollTop = y;
    // the explorer card's own scroll offset and its search box's focus/caret — restorable only
    // now that the nodes this pass built are actually in the document (see fxRestoreAfterPaint)
    fxRestoreAfterPaint();
  } finally {
    boardBusy = false;
    if (boardAgain) {
      boardAgain = false;
      void renderBoard();
    }
  }
}
$("boardclose").onclick = () => setBoard(false);
applyBoard();
// the board's own 3s interval used to live here — it is armed by the poll pump now (grep
// armPolls), together with refresh(), so document.hidden is handled in exactly one place.

// --- THE ONE COMPOSER ------------------------------------------------------------------------
// Owner 2026-09-19: the conversation view's input REPLACES the box under the terminal — there is
// one input component on this board, in two sizes. `bar` is the low form under a terminal pane;
// `tall` is the rounded surface of the reference shot, with the model/effort switch in its bottom
// row. Fifth cut (owner: "nur eine Art von EingabeFeld … nach oben hin ausklappend-höher"): the
// composer has ONE place — #bar, centred at the transcript's column width — in both views. A view
// switch only toggles the size class; #bar is the last item of the main column, so the extra
// height pushes the panes up and the bottom edge stays where it is.
const compEl = $("comp"), compOpts = $("compopts"), compTray = $("comptray"), compFiles = $("compfiles");

function setComposerSize(size: "bar" | "tall"): void {
  reshapeSurface(() => {
    compEl.classList.toggle("tall", size === "tall");
    compEl.classList.toggle("bar", size === "bar");
    ta.rows = 1;
    fitTextarea();
  });
}

function fitTextarea(): void {
  ta.style.height = "auto";
  ta.style.height = `${Math.min(compEl.classList.contains("tall") ? 220 : 140, ta.scrollHeight)}px`;
}
function growComposer(): void {
  reshapeSurface(fitTextarea);
}

// Owner (eighth cut): the surface's growth is ANIMATED — the jump between two heights (a line more
// or less, an attachment in or out, the size switch), never each keystroke: a change that leaves
// the height alone returns here without touching anything. Measure, apply, measure, then run from
// the old height to the new one with the composer's one duration (--t in index.html, 160 ms);
// clipping is on only during that run, because the model/effort popovers live inside the surface.
// A change arriving mid-run starts from the height on screen, so nothing snaps back.
const compSurface = $("compsurface");
const SURFACE_MS = 160; // = --t in index.html
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let surfaceTimer: ReturnType<typeof setTimeout> | undefined;
function reshapeSurface(change: () => void): void {
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
    requestAnimationFrame(() => { for (const p of panes) p.refit(); });
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
function mountComposer(): void {
  const pane = panes[focused];
  setComposerSize(pane?.isChat ? "tall" : "bar");
  renderComposerOpts(false);
}

// the model/effort switches: conversation view only, and only what the SLOT'S ADAPTER carries
// (GET /api/harnesses). Same rule as the second cut — what a harness has no concept of is absent,
// not greyed — and the same two-half write (setSlotSetting). Seventh cut (owner: "effort und modell
// getrennt … ein übernahme-bestätigungs button … bevor dann wirklich der cmnd an die session geht"):
// TWO controls in the surface's bottom row, each with its own small popover, and a pick is STAGED,
// never run — only the popover's Apply writes the record and types into the pane. Closing without
// Apply discards. State lives here, outside the DOM, because the poll repaints the row whenever the
// slot's values move (measured in the second cut: a verdict held in a replaced node reads as silence).
type OptField = "model" | "effort";
let optsKey = "";
let optOpen: OptField | null = null;
let optStaged: Partial<Record<OptField, string>> = {};
let optMsg: Partial<Record<OptField, string>> = {};
let optsSlot = 0;
// Twelfth cut: Apply on the MODEL switch first asks (owner: a model switch costs the session its
// prompt cache). The ask is state, not DOM, for the reason optOpen is — the poll repaints the row.
let optConfirm = false;
const WARN_KEY = "fleet.modelSwitchWarn";
function modelWarnOff(): boolean {
  try { return localStorage.getItem(WARN_KEY) === "off"; } catch { return false; }
}
function setModelWarnOff(): void {
  try { localStorage.setItem(WARN_KEY, "off"); } catch { /* private window: it simply asks again */ }
}

// THE CACHE COUNTER (owner, twelfth cut: "seit der letzten Nachricht … ob der Cache noch warm sein
// dürfte", threshold 5 min; fifteenth cut: "seit dem letzten API-Request"). Reference = the newest
// transcript entry that STARTS a request — a prompt or a tool result — by its own timestamp (Pane.lastTurnAt,
// from the transcript poll the conversation view already runs, or the owner's own send, whichever
// is newer) — not lastOutput, which moves with any byte the pane paints. Both are read on the
// SERVER's clock (serverClock): the timestamps are written there, the viewer may be a phone. What the TTL of a given session IS stays unmeasured: Claude Code's own
// rule (2.1.278) is 1 h for the main conversation on a subscription within its limits and 5 min on
// an API key or in overage, and nothing on this board says which applies — hence "probably". The
// owner runs on the 5 min TTL (thirteenth cut) and wants the turn to cold 20 s BEFORE it, so the
// expiry never arrives as a surprise.
const CACHE_TTL_MS = 5 * 60_000;
const CACHE_COLD_AT_MS = CACHE_TTL_MS - 20_000;
let ageEl: HTMLElement | null = null;
const fmtAge = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
// the server's clock now — transcript timestamps and a send stamped here are both in its frame
const serverClock = (): number => Date.now() + serverClockSkew;
function cacheAge(): number | null {
  const p = panes[focused];
  // codex and pi write no transcript this board reads: there is no reference point, so no counter
  if (!p?.slot || !harnessEntry(p.slot)?.supports.transcript) return null;
  const at = p.lastTurnAt;
  return at ? Math.max(0, serverClock() - at) : null;
}
function tickCacheAge(): void {
  if (!ageEl?.isConnected) return;
  const ms = cacheAge();
  ageEl.hidden = ms === null;
  if (ms === null) return;
  const cold = ms >= CACHE_COLD_AT_MS;
  ageEl.textContent = fmtAge(ms);
  ageEl.classList.toggle("cold", cold);
  ageEl.title = cold
    ? `last message ${fmtAge(ms)} ago — ${ms >= CACHE_TTL_MS ? "the prompt cache is probably cold" : "the prompt cache expires shortly"} (5 min TTL)`
    : `last message ${fmtAge(ms)} ago — the prompt cache is probably still warm (5 min TTL)`;
}
setInterval(() => { if (!document.hidden) tickCacheAge(); }, 1000);

function renderComposerOpts(force: boolean): void {
  const pane = panes[focused];
  // the switches live in the conversation view — or, for a harness that HAS none (no transcript:
  // pi, codex), in the terminal view, its only one (fifteenth cut: pi had no switch anywhere)
  const slot = pane?.slot && (pane.isChat || harnessEntry(pane.slot)?.supports.transcript === false) ? pane.slot : 0;
  const h = slot ? harnessEntry(slot) : null;
  const s = fleet.find((x) => x.id === slot);
  const key = [slot, h?.id ?? "", s?.model ?? "", s?.effort ?? "", defaultModel ?? ""].join("|");
  if (!force && key === optsKey) return;
  optsKey = key;
  // a pick staged for one session must never be applied to the next one the focus lands on
  if (slot !== optsSlot) { optsSlot = slot; optOpen = null; optStaged = {}; optMsg = {}; optConfirm = false; }
  compOpts.replaceChildren();
  if (!h || !slot) return;
  if (h.supports.model) {
    ageEl = el("span", "optage");
    ageEl.hidden = true;
    compOpts.appendChild(ageEl);
    tickCacheAge();
    const current = s?.model ?? "";
    // an unpinned slot runs the fleet default only where the server bakes it in (the default
    // harness, server.ts#DEFAULT_MODEL); elsewhere the harness picks, and the client cannot know
    const shown = current || (h.default && defaultModel ? defaultModel : "—");
    const mark = harnessMark(h.id);
    compOpts.appendChild(optSwitch("model", slot, current, shown, mark ? [el("span", "optmark")] : [], (stage) => {
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
      // one entry per NAME: claude-opus-5 and claude-opus-5[1m] read the same ("Opus 5 · 1M") and
      // resolve the same in Claude Code 2.1.278 (both native_1m), so two identical rows would only
      // ask the owner to pick between twins. The kept id is the slot's own if it is one of them,
      // else the adapter's first; the other stays reachable through the free-text field.
      const byName = new Map<string, string>();
      for (const m of h.models ?? []) {
        const name = modelLabel(m);
        if (!byName.has(name) || m === current) byName.set(name, m);
      }
      for (const m of byName.values()) {
        const b = el("button", "cmdmodel", modelLabel(m)) as HTMLButtonElement;
        b.dataset.id = m;
        b.title = m;
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
    }, mark, modelLabel));
  }
  if (h.supports.effort && h.effortLevels.length) {
    const current = s?.effort ?? "";
    compOpts.appendChild(optSwitch("effort", slot, current, current || "default", [], (stage) => {
      const levels = el("div", "cmdlevels");
      for (const lv of h.effortLevels) {
        const b = el("button", "cmdlevel", lv) as HTMLButtonElement;
        b.classList.toggle("cur", lv === current);
        b.classList.toggle("staged", lv === optStaged.effort && lv !== current);
        b.onclick = () => {
          stage(lv);
          for (const o of levels.children) o.classList.toggle("staged", o === b && lv !== current);
        };
        levels.appendChild(b);
      }
      return { row: [levels] };
    }, null));
  }
}

// Close whatever is open and forget what was staged in it — closing without Apply discards.
function closeOpts(focusField?: OptField): void {
  optOpen = null;
  optStaged = {};
  optMsg = {};
  optConfirm = false;
  renderComposerOpts(true);
  if (focusField) compOpts.querySelector<HTMLElement>(`.optswrap.${focusField} .optsw`)?.focus();
}

// one switch = its (staged or current) value with a chevron, and a small popover: the field's own
// control(s), then Apply. The verdict line appears only after an Apply, never as an empty row.
function optSwitch(field: OptField, slot: number, current: string, shown: string, lead: HTMLElement[],
  body: (stage: (v: string) => void) => { list?: HTMLElement; row: HTMLElement[] }, mark: Element | null,
  label: (v: string) => string = (v) => v): HTMLElement {
  const wrap = el("div", `optswrap ${field}`);
  const btn = el("button", "optsw") as HTMLButtonElement;
  const inPane = switchesInPane(harnessEntry(slot));
  const what = inPane
    ? `sets the slot record AND types /${field} into the pane — only when you press Apply`
    : `sets the slot record and RESTARTS the pane with it (this harness has no in-session /${field}) — only when you press Apply`;
  const tip = (v: string) => `${mark ? `${harnessEntry(slot)?.id ?? ""} · ` : ""}${field} ${v} — ${what}`;
  if (mark) lead[0]?.appendChild(mark);
  const val = el("span", `optval${field === "effort" ? " dim" : ""}`, label(optStaged[field] ?? shown));
  btn.append(...lead, val);
  btn.appendChild(el("span", "optchev")).appendChild(icon("chevron"));
  const pop = el("div", `optpop ${field}`);
  const apply = el("button", "cmdapply", "Apply") as HTMLButtonElement;
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
    apply.textContent = "Applying…";
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
      ? "Switching the model drops this session's prompt cache — the next turn re-reads the full context."
      : `${harnessEntry(slot)?.id ?? "This harness"} has no in-session /${field}: Switch restarts the pane with the new ${field} and resumes the conversation. Whatever it is doing right now stops.`));
    if (ms !== null) box.appendChild(el("div", "cfage", `Last message ${fmtAge(ms)} ago${ms >= CACHE_TTL_MS ? " — the cache is probably cold already" : ms >= CACHE_COLD_AT_MS ? " — the cache expires shortly" : ""}.`));
    const opt = el("label", "cfskip");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    opt.append(cb, document.createTextNode("Don't show again"));
    opt.hidden = !inPane; // a restart is asked every time
    const cancel = el("button", "cmdcancel", "Cancel") as HTMLButtonElement;
    cancel.onclick = () => cancelConfirm();
    const go = el("button", "cmdapply", "Switch") as HTMLButtonElement;
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
document.addEventListener("pointerdown", (e) => {
  const t = e.target;
  if (!optOpen || (t instanceof Element && t.closest(".optswrap"))) return;
  closeOpts();
});
// Cancel on the model-switch question: back to the list, the pick still staged, nothing sent
function cancelConfirm(): void {
  optConfirm = false;
  renderComposerOpts(true);
  compOpts.querySelector<HTMLElement>(".optswrap.model .cmdapply")?.focus();
}
// Escape cancels the question if one is open, otherwise closes the switch popover (discarding) and
// hands focus back to its switch
compOpts.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || !optOpen) return;
  e.preventDefault();
  e.stopPropagation();
  if (optConfirm) cancelConfirm();
  else closeOpts(optOpen);
});

// --- the tray under the surface. ENTRIES ARE DATA: a later one is a row here, not a rebuild.
// Every entry is an existing function of this board that used to own an icon button of its own.
const TRAY: { id: string; label: string; icon: IconName; run?: () => void }[] = [
  { id: "files", label: "Files", icon: "folder", run: () => dropFile.click() },
  { id: "histbtn", label: "History", icon: "history" },
  { id: "autobtn", label: "Schedule", icon: "clock" },
  { id: "live", label: "Live", icon: "keys" },
];
function buildTray(): void {
  for (const entry of TRAY) {
    if (entry.run) {
      const b = el("button", "") as HTMLButtonElement;
      b.title = "attach files to this session";
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

function focusPane(index: number) {
  const changed = focused !== index;
  focused = index;
  for (const p of panes) p.root.classList.toggle("focused", p.index === focused);
  const slot = panes[focused]?.slot;
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
    b.classList.toggle("active", b.dataset.l === String(n));
  requestAnimationFrame(() => { for (const p of panes) p.refit(); });
  focusPane(Math.min(focused, n - 1));
}

// sidebar click: assign to the focused pane — unless the slot is already
// visible in another pane (same slot twice = two sessions fighting over resize)
function showSlot(id: number) {
  const s = fleet[id - 1];
  if (!s?.cwd) return;
  // §F3 edge 2 — focus beats fold. Whatever route got here (a ⏸ badge, an adopt, a merge job
  // finishing, the board), the session you are now looking at must have a visible row: a pane
  // showing a lane while the sidebar pretends it isn't there is worse than no folding at all.
  if (s.worktree) {
    const stack = stacksOf().find((g) => g.lanes.some((lane) => lane.id === s.id));
    if (stack && !stackOpen.has(stack.foldKey)) setStackOpen(stack, true);
  }
  setDrawer(false);
  const existing = panes.find((p) => p.slot === id);
  if (existing) { existing.focus(); existing.flash(); return; }
  const target = panes[focused];
  target.assign(id);
  target.flash();
}

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    // the picker and the review window are src/shell.ts windows — they swallow their own Escape
    if (hist.style.display === "flex") closeHist();
    if (sharedlg.style.display === "flex") closeShareDlg();
    if (autodlg.style.display === "flex") closeAutoDlg();
    setDrawer(false);
  }
});
window.addEventListener("resize", () => { for (const p of panes) p.refit(); });

// crossing the mobile breakpoint (rotation, window resize) rebuilds the panes so
// per-pane mobile settings (font size, inputMode, forced single layout) re-apply
MOBILE_MQ.addEventListener("change", () => {
  setDrawer(false);
  setLive(false); // the live bar is a mobile-only surface
  applyCollapsed(); // strip the rail on mobile, restore it on desktop
  applyBoard(); // same for the right sideboard — a desktop-only surface
  setLayout(isMobile() ? 1 : layout, panes.map((p) => p.slot));
});

// iOS Safari: the on-screen keyboard shrinks the visual viewport but not the layout
// viewport — track it so the compose bar stays visible above the keyboard
const vv = window.visualViewport;
if (vv) {
  let vvRefitTimer: ReturnType<typeof setTimeout> | undefined;
  const sync = () => {
    if (isMobile()) document.documentElement.style.setProperty("--vvh", `${Math.round(vv.height)}px`);
    else document.documentElement.style.removeProperty("--vvh");
    window.scrollTo(0, 0);
    // the keyboard opening/closing and its predictive-text bar toggling fire several of
    // these in a burst while typing; settle before refitting so a mid-transition height
    // reading doesn't trigger a spurious /resize (and the server's redraw jiggle) on
    // every micro-wobble — this was blanking the active input line while composing
    clearTimeout(vvRefitTimer);
    vvRefitTimer = setTimeout(() => { for (const p of panes) p.refit(); }, 200);
  };
  vv.addEventListener("resize", sync);
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

// --- live typing mode (mobile): a real visible input relays every keystroke to the
// focused pane, same approach as claude-deck — xterm's hidden helper textarea is
// unreliable on iOS (keyboard often won't open, autocorrect swallows input)
const live = $("live"), livebar = $("livebar"), livein = $("livein") as HTMLInputElement;
let liveOn = false;
function setLive(on: boolean) {
  liveOn = on;
  live.classList.toggle("on", on);
  livebar.style.display = on ? "flex" : "none";
  // reveal the field but don't focus it — tapping it is what should open the keyboard
  if (!on) livein.blur();
}
live.onclick = () => setLive(!liveOn);
const LIVE_KEYS: Record<string, string> = {
  Enter: "\r", Escape: "\x1b", Backspace: "\x7f", Tab: "\t",
  ArrowUp: "\x1b[A", ArrowDown: "\x1b[B", ArrowRight: "\x1b[C", ArrowLeft: "\x1b[D",
};
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

for (const b of document.querySelectorAll<HTMLButtonElement>("#layouts button"))
  b.onclick = () => {
    setLayout(LAYOUTS[b.dataset.l ?? "1"] ?? 1, panes.map((p) => p.slot));
    saveView();
  };

function saveView() {
  localStorage.setItem("fleet.view", JSON.stringify({ layout, panes: panes.map((p) => p.slot), focused }));
}

// --- directory picker ---
// Re-hosted in the src/shell.ts window; it was a 520px .panel with a list and three buttons. Same
// rows, same pins, same type-a-few-letters-then-Enter path — plus the detail pane that answers the
// question the old picker structurally could not: what IS this folder. A RE-HOST rather than a
// rewrite on purpose. PK_ICONS below is pinned by fleet-e2e-security.ts §7, and the row anatomy
// (pin star, ⎇ badge, start ▸) was already the part that worked.
//
// One interaction DID change, and it is the platform-standard direction: a single click selects
// (and the detail follows) instead of navigating. Navigating in is now double-click or Enter, as it
// is in Finder, Explorer and VS Code. Single-click-to-navigate made a detail pane unreachable —
// you could never rest on a folder long enough to read about it. It also drops a 250ms timer that
// only existed to tell a first click from a double.
let pickerSlot = 0;
let pkShell: Shell | null = null;
let pkPins = new Set<string>(); // pinned paths, refreshed from /api/dirs on every browse()
// worktree lanes clutter the picker (recents are mostly `*.worktrees/fleet-*`); hide them by
// default. View-only pref, per device — kept in localStorage like the board/histall toggles.
let hideWorktrees = localStorage.getItem("fleet.hidewt") !== "0";
// dotfolders were filtered out of every listing, so .claude and .github simply did not exist in the
// picker — you could not start a session in one without typing its path. Off by default (a home
// directory has more dot-entries than real ones), per device, like the lane toggle above.
let showHidden = localStorage.getItem("fleet.pkdot") === "1";
// a path is a lane if it lives under (or is) a `.worktrees` dir — reliable, no false positives
function isWtPath(p: string): boolean { return /\.worktrees(\/|$)/.test(p); }

// `way` = a row that is only on the PATH to a search hit, not a hit itself. It is drawn (a match
// with no parents above it is unplaceable) but it is not counted as a match.
interface PkRow { row: HTMLElement; path: string; name: string; head: HTMLElement | null; wt: boolean; way: boolean }
let pkRows: PkRow[] = [];
// the window's own controls, rebuilt on every open (the window itself is created per open)
let pkFilter: HTMLInputElement;
let pkPathIn: HTMLInputElement;
let pkCrumb: HTMLElement;
let pkHideBtn: HTMLButtonElement;
let pkDotBtn: HTMLButtonElement;

function closePicker() { pkShell?.close(); }

// a row is out when the worktree toggle hides it (pkwt) OR the text filter excludes it (pkhide)
function pkVisible(): PkRow[] {
  return pkRows.filter((r) => !r.row.classList.contains("pkhide") && !r.row.classList.contains("pkwt"));
}

// the shell walks the rows it was handed, so it must be handed only the ones actually on screen —
// otherwise ↑/↓ stops on a row hidden by the filter or the lane toggle
function pkSyncRows(select: number) {
  const shell = pkShell;
  if (!shell) return;
  const vis = pkVisible();
  shell.setRows(vis.map((r) => ({ el: r.row, open: () => void browse(r.path) })));
  if (select >= 0 && vis.length) shell.select(Math.min(select, vis.length - 1));
  else shell.select(-1, false, false);
}

// mark/unmark worktree rows, refresh section counts to match, then re-run the text filter
function applyWtHide() {
  for (const r of pkRows) r.row.classList.toggle("pkwt", hideWorktrees && r.wt);
  // section count badges show how many rows survive the toggle (so RECENT 4→2 signals what it did).
  // the "Up to …" parent row is navigation, not a folder in this dir — exclude it from the count.
  // So is a `way` row: counting the folders a search walked THROUGH as matches would inflate the
  // one number on screen that says how much the query found.
  const counts = new Map<HTMLElement, number>();
  const dropped = new Map<HTMLElement, number>();
  for (const r of pkRows) {
    if (!r.head || r.row.classList.contains("up") || r.way) continue;
    const off = r.row.classList.contains("pkwt");
    counts.set(r.head, (counts.get(r.head) ?? 0) + (off ? 0 : 1));
    if (off) dropped.set(r.head, (dropped.get(r.head) ?? 0) + 1);
  }
  // A COUNT THAT SHRANK IS NOT A COUNT THAT EXPLAINS ITSELF. The badge was never wrong — it always
  // showed the surviving rows — but it did not say that any were left out. Measured 2026-08-04 on
  // the live board: Recent held 8 entries and read "3", the five missing ones being every lane the
  // owner had worked in that day, hidden by a toggle localStorage had never been asked about
  // (`fleet.hidewt` unset reads as ON). The folder detail pane already says "… · 2 hidden" for its
  // dot-entries, so this is the app's own vocabulary, not a new one.
  for (const [head, n] of counts) {
    const b = head.querySelector<HTMLElement>(".shellsecn");
    if (!b) continue;
    const h = dropped.get(head) ?? 0;
    b.textContent = h ? `${n} · ${h} hidden` : String(n);
    b.classList.toggle("reveal", h > 0);
    b.title = h ? `${h} worktree lane${h === 1 ? "" : "s"} hidden by the ⎇ toggle — click to show them` : "";
    // routed through the toggle's own button rather than re-implementing it: one place decides what
    // hiding means, persists it, and repaints, so this can never drift from the ⎇ control
    b.onclick = h ? (ev: MouseEvent): void => { ev.stopPropagation(); pkHideBtn.click(); } : null;
  }
  applyPkFilter();
}

function applyPkFilter() {
  const q = pkFilter.value.trim().toLowerCase();
  const headHits = new Map<HTMLElement, number>();
  for (const r of pkRows) {
    // in search mode the tree rows ARE the result: the server chose them, and the folders on the
    // way to a hit do not carry the query in their own name. Re-testing them here would hide the
    // deep matches the search just went and found — the substring test only owns the shortcuts.
    const hit = q === "" || r.name.includes(q) || (pkFind !== null && r.row.classList.contains("tree"));
    r.row.classList.toggle("pkhide", !hit);
    // a row counts toward its section head only if it survives BOTH the query and the wt toggle
    const shown = hit && !r.row.classList.contains("pkwt");
    if (r.head) headHits.set(r.head, (headHits.get(r.head) ?? 0) + (shown ? 1 : 0));
  }
  for (const [head, n] of headHits) head.classList.toggle("pkhide", n === 0);
  pkSyncRows(q ? 0 : -1); // filtering pre-selects the best match so Enter just works
}

function renderHideWtBtn() {
  pkHideBtn.textContent = "⎇ hide lanes";
  pkHideBtn.classList.toggle("on", hideWorktrees);
  pkHideBtn.title = hideWorktrees ? "worktree lanes hidden — click to show them" : "click to hide worktree lanes";
}

function renderDotBtn() {
  pkDotBtn.textContent = "· hidden";
  pkDotBtn.classList.toggle("on", showHidden);
  pkDotBtn.title = showHidden
    ? "dotfolders (.claude, .github) are listed — click to hide them again"
    : "click to list dotfolders too (.claude, .github) — they are hidden by default";
}

// crisp monochrome glyphs (stroke = currentColor, tinted per row-kind in CSS). Static markup,
// no interpolated data — safe to set via innerHTML.
const PK_ICONS: Record<string, string> = {
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h3.2l1.8 2H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  folderOpen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 19V7a2 2 0 0 1 2-2h3.2l1.8 2H19a2 2 0 0 1 2 2v1.5"/><path d="M5.6 19h13a1.6 1.6 0 0 0 1.55-1.2l1.35-5.2A1 1 0 0 0 20.5 11.3H8.4a1.6 1.6 0 0 0-1.55 1.2l-1.35 5.2A1.6 1.6 0 0 1 3.5 19"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M13.5 3v5.5H19"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v4.7l3 1.8"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V6M6 11l6-6 6 6"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 3l2.6 5.8 6.4.6-4.8 4.2 1.4 6.2L12 17l-5.6 2.8 1.4-6.2L3 9.4l6.4-.6z"/></svg>',
};
function pkIcon(kind: string): HTMLElement {
  const s = el("span", "pkicon");
  s.innerHTML = PK_ICONS[kind] ?? PK_ICONS.folder;
  return s;
}

interface DirRowOpts { label: string; sub?: string; path: string; cls: string; icon: string;
  repo?: boolean; wt?: boolean; depth?: number; tree?: boolean;
  // one flag per ANCESTOR level: true where that ancestor was the last of its siblings, so the
  // spine at that level must stop rather than run past a branch that has nothing below it
  blanks?: boolean[]; last?: boolean;
  // search only: "hit" = this row's name matched, "way" = it is a folder on the path to one
  find?: "hit" | "way" }
function dirRow(o: DirRowOpts): HTMLElement {
  const open = !!o.tree && pkIsOpen(o.path);
  // `open` rides on the ROW, not just the ▸: it is what grows the line the children hang from,
  // tints the icon, and turns the glyph. One state, one class, three things saying the same.
  const row = el("div", `pkrow ${o.cls}${o.tree ? " tree" : ""}${open ? " open" : ""}`
    + (o.find ? ` pk${o.find}` : ""));
  row.title = o.path;
  if (o.tree) {
    // one guide span per ancestor level, each a vertical rule stretched over the FULL row box — that
    // is what makes the lines continuous from row to row instead of a ladder of dashes. They live
    // in their own container so .pkrow's 10px gap does not space them apart. The guide at the row's
    // OWN level turns horizontally into the name (├), or corners into it if this is the last child
    // (└) — that turn is what makes a column of names read as a branch of a tree.
    const lead = el("span", "pklead");
    const depth = o.depth ?? 0;
    // depth + 1 columns, not depth: the row's OWN level gets an elbow too, so a top-level folder
    // hangs off the same spine as everything below it and the whole section reads as ONE tree.
    // Drawing them only for nested rows left the top level flat, and the first expansion then
    // sprouted a line out of nowhere — the shape `tree(1)` gets right by connecting every entry.
    for (let i = 0; i <= depth; i++) {
      const g = el("span", "pkguide");
      if (i === depth) g.classList.add(o.last ? "end" : "branch");
      else if (o.blanks?.[i]) g.classList.add("blank");
      lead.appendChild(g);
    }
    const tw = el("span", `pktw${open ? " open" : ""}`, open ? "▾" : "▸");
    tw.title = open ? "collapse (←)" : "expand (→)";
    tw.onclick = (e) => { e.stopPropagation(); void toggleNode(o.path); };
    lead.appendChild(tw);
    row.appendChild(lead);
  }
  // A folder icon on tree rows after all. It was dropped when every tree row was the same closed
  // folder and the glyph therefore distinguished nothing — but an icon that OPENS is not the same
  // glyph twice: it carries the one thing the name cannot say, and it says it in the place the eye
  // already is. The shortcut sections keep their own kinds (star, clock, folder, up-arrow).
  row.appendChild(pkIcon(o.tree ? (open ? "folderOpen" : "folder") : o.icon));
  const name = el("span", "pkname");
  name.appendChild(el("span", "pkleaf", o.label));
  if (o.sub) name.appendChild(el("span", "pksub", o.sub));
  row.appendChild(name);
  if (o.repo) {
    const g = el("span", "pkgit", "⎇");
    g.title = "git repo — ⌘Enter or “new lane” starts a worktree here";
    row.appendChild(g);
  }
  // pin star: filled+amber when pinned (always shown), a ghost outline on hover otherwise.
  // stopPropagation keeps the click off the row's browse/start timer.
  const pinned = pkPins.has(o.path);
  const star = el("span", `pkpin${pinned ? " on" : ""}`, pinned ? "★" : "☆");
  star.title = pinned ? "unpin (⌘D)" : "pin this folder (⌘D)";
  star.onclick = (e) => { e.stopPropagation(); void togglePin(o.path); };
  row.appendChild(star);
  // click 1 selects AND opens the folder (the detail pane follows), click 2 STARTS A SESSION here.
  // No timer: both are idempotent-or-invisible, so the first click of a double-click costs nothing
  // to let through — which is exactly what forced the old 250ms reconciliation. (A double-click
  // that lands on a closed folder expands it on the way past; the window closes on the session it
  // starts, so that is never seen.)
  // Clicking the ROW to open it, not just the ▸, is what Finder, Explorer and VS Code all do, and
  // the ▸ was an 18px target for the most common action in the window. Re-rooting — making a folder
  // the top of the tree — stays on the breadcrumb, the "Up to …" row, the path box and Enter. The
  // one row kind that navigates on double-click is "Up to …": it names a destination, not a place
  // to work.
  row.onclick = (e) => {
    if (e.detail >= 2) { void (o.cls === "up" ? browse(o.path) : startSession(o.path)); return; }
    // "Up to …" is pure navigation, and a phone has no comfortable double-click: one tap goes up.
    // On a pointer device the double-click still does it and a single click inspects, unchanged.
    if (o.cls === "up" && isMobile()) { void browse(o.path); return; }
    const i = pkVisible().findIndex((r) => r.row === row);
    if (i >= 0) pkShell?.select(i, false, false);
    void showDirDetail(o.path);
    // A click on a folder OPENS AND CLOSES it — the whole gesture, the way an explorer works. It
    // used to open only, on the theory that collapsing would make the row under the cursor jump
    // away; that theory was wrong, because collapsing removes the rows BELOW this one and leaves
    // this one exactly where it is.
    // Touch is the exception: there the same tap also pushes the detail pane OVER the list, so a
    // collapse would happen behind it and be discovered on the way back — the folder you just
    // opened, shut. On touch the tap only opens, and ▸ still closes.
    if (o.tree && !(isMobile() && pkIsOpen(o.path))) void toggleNode(o.path);
    // On a phone there is no second column, so the detail has to be PUSHED or it cannot be seen at
    // all — which is exactly what it was: the picker never called this, so everything the pane
    // knows (what is in the folder, its commits, "already open in slot N", ⎇ New lane) was
    // desktop-only. The tree stays reachable: ▸ expands without leaving the list, and ‹ comes back.
    if (isMobile()) pkShell?.showDetail(true);
  };
  const use = el("span", "pkuse", "start ▸");
  use.onclick = (e) => {
    e.stopPropagation();
    void startSession(o.path);
  };
  row.appendChild(use);
  return row;
}

// clickable path: each ancestor segment jumps straight there. /Users/<me> collapses to ~.
function renderCrumb(path: string) {
  pkCrumb.replaceChildren();
  const home = /^(\/Users\/[^/]+)(\/.*)?$/.exec(path);
  const segs: { label: string; full: string }[] = [];
  let base: string;
  let rest: string;
  if (home) {
    segs.push({ label: "~", full: home[1] });
    base = home[1];
    rest = home[2] ?? "";
  } else {
    segs.push({ label: "/", full: "/" });
    base = "";
    rest = path;
  }
  for (const part of rest.split("/").filter(Boolean)) {
    base = `${base}/${part}`;
    segs.push({ label: part, full: base });
  }
  segs.forEach((s, i) => {
    if (i) pkCrumb.appendChild(el("span", "pksep", "›"));
    const seg = el("span", "pkseg", s.label);
    if (i === segs.length - 1) { seg.classList.add("here"); seg.title = s.full; }
    else { seg.title = s.full; seg.onclick = () => void browse(s.full); }
    pkCrumb.appendChild(seg);
  });
  pkCrumb.scrollLeft = pkCrumb.scrollWidth; // keep the current folder in view when deep
  // fade the left edge when ancestors have scrolled out of view, so hidden segments are hinted
  pkCrumb.classList.toggle("overflow", pkCrumb.scrollWidth > pkCrumb.clientWidth + 1);
}

async function browse(path: string): Promise<boolean> {
  const res = await api(dirsUrl(path));
  const data = (await res.json()) as
    | { path: string; parent: string | null; dirs: string[]; repos?: string[]; worktrees?: string[];
        recents: string[]; pins?: string[]; common: string[]; git?: boolean;
        total?: number; capped?: boolean }
    | { error: string };
  const shell = pkShell;
  if (!shell) return false;
  if ("error" in data) {
    pkPathIn.classList.add("bad");
    setTimeout(() => pkPathIn.classList.remove("bad"), 1200);
    return false;
  }
  pkPathIn.value = data.path;
  pkPathIn.classList.remove("bad");
  renderCrumb(data.path);
  pkPins = new Set(data.pins ?? []);
  localStorage.setItem("fleet.pkdir", data.path); // next openPicker starts where you left off
  pkFilter.value = "";
  // a new root is a new tree: nothing below it is expanded, and the cached children of the old
  // root's descendants would only be stale weight. A search belongs to the root it ran under, so
  // it goes with them.
  clearFind();
  pkRoot = data.path;
  pkOpen.clear();
  pkKids.clear();
  pkCap.clear();
  noteCap(data.path, data.total, data.capped);
  pkKids.set(data.path, nodesOf(data.path, data.dirs, data.repos, data.worktrees));
  pkShortcuts = { pins: data.pins ?? [], recents: data.recents, common: data.common, parent: data.parent };
  paintPicker();
  // the detail describes the folder you just navigated INTO until the cursor moves, so the pane is
  // never empty and its actions always have an unambiguous target
  void showDirDetail(data.path);
  return true;
}

// --- the folder tree ---
// The picker listed ONE directory at a time. Seeing whether a repo held the subfolder you wanted
// meant navigating in, looking, and navigating back out — and the shortcut sections scrolled away
// while you did it. Now the folders under the current root are a tree you expand in place, with a
// guide line down each level so the nesting is readable at a glance rather than counted in spaces.
interface PkNode { name: string; path: string; repo: boolean; wt: boolean; hit?: boolean }
let pkRoot = "";
const pkKids = new Map<string, PkNode[]>(); // path → its subfolders, fetched once per expansion
const pkOpen = new Set<string>();           // which paths are expanded
const pkBusy = new Set<string>();           // expansions in flight, so a double-click fetches once
// path → how many subfolders it REALLY has, recorded only where the server's listing cap bit. The
// tree used to serve 200 of them and say nothing, which reads exactly like a folder with 200 in it.
const pkCap = new Map<string, number>();
// A search is its own tree — the hits plus the folders on the way to them, nothing else. It is kept
// SEPARATE from pkKids on purpose: merged in, a search's partial listing of a folder would be
// cached as that folder's full contents and every later expansion of it would quietly be short.
interface PkFind { q: string; kids: Map<string, PkNode[]>; open: Set<string>; partial: Set<string>;
  hits: number; truncated: boolean }
let pkFind: PkFind | null = null;
let pkFindSeq = 0;                  // latest-wins: typing outruns the searches it starts
let pkFindTimer: ReturnType<typeof setTimeout> | null = null;
const PK_FIND_MIN = 2;              // one letter matches most of a disk — that is not a search
let pkShortcuts: { pins: string[]; recents: string[]; common: string[]; parent: string | null } =
  { pins: [], recents: [], common: [], parent: null };

// which tree the picker is currently drawing: the browsed one, or a search's own
function pkKidsOf(path: string): PkNode[] { return (pkFind ? pkFind.kids : pkKids).get(path) ?? []; }
function pkIsOpen(path: string): boolean { return (pkFind ? pkFind.open : pkOpen).has(path); }

// every listing request carries the dotfolder toggle: what the tree contains has to follow the
// button that says what it contains
function dirsUrl(path: string, extra = ""): string {
  return `/api/dirs?path=${encodeURIComponent(path)}${showHidden ? "&hidden=1" : ""}${extra}`;
}

function nodesOf(base: string, dirs: string[], repos?: string[], worktrees?: string[]): PkNode[] {
  const repoSet = new Set(repos ?? []);
  const wtSet = new Set(worktrees ?? []);
  return dirs.map((d) => ({
    name: d, path: `${base}/${d}`.replace("//", "/"),
    repo: repoSet.has(d), wt: wtSet.has(d) || d.endsWith(".worktrees"),
  }));
}

// note what the server said it left out, so emit() can draw the line that says so
function noteCap(path: string, total?: number, capped?: boolean) {
  if (capped && typeof total === "number") pkCap.set(path, total);
  else pkCap.delete(path);
}

async function fetchKids(path: string): Promise<PkNode[] | null> {
  const res = await api(dirsUrl(path)).catch(() => null);
  if (!res || !res.ok) return null;
  const d = (await res.json().catch(() => null)) as
    { path?: string; dirs?: string[]; repos?: string[]; worktrees?: string[];
      total?: number; capped?: boolean } | null;
  if (!d?.path || !d.dirs) return null;
  noteCap(d.path, d.total, d.capped);
  return nodesOf(d.path, d.dirs, d.repos, d.worktrees);
}

async function toggleNode(path: string) {
  const open = pkFind ? pkFind.open : pkOpen;
  const kids = pkFind ? pkFind.kids : pkKids;
  if (open.has(path)) { open.delete(path); paintPicker(); return; }
  // a search's synthesized listing holds only the children that lead to a match; re-opening such a
  // folder fetches what is ACTUALLY in it, so expanding a result never shows a doctored directory
  const partial = pkFind?.partial;
  if (!kids.has(path) || partial?.has(path)) {
    if (pkBusy.has(path)) return;
    pkBusy.add(path);
    const fresh = await fetchKids(path);
    pkBusy.delete(path);
    if (!pkShell?.isOpen()) return;
    // an unreadable folder (permissions, or it vanished) caches as EMPTY rather than retrying on
    // every click — the row then says so instead of silently doing nothing
    kids.set(path, fresh ?? []);
    partial?.delete(path);
  }
  open.add(path);
  paintPicker();
}

// --- the search's own tree ---
// The server answers with flat paths. Drawn flat they would be a list of names with no idea where
// any of them is; drawn here they become the same tree as everything else, with the folders between
// the root and each hit filled in as scaffolding (`hit: false`) so a match is never rootless.
function buildFindTree(root: string, hits: { path: string; name: string; repo: boolean; wt: boolean }[],
                       q: string, truncated: boolean): PkFind {
  const kids = new Map<string, PkNode[]>();
  const open = new Set<string>();
  const partial = new Set<string>();
  const hitPaths = new Set(hits.map((h) => h.path));
  for (const h of hits) {
    if (!h.path.startsWith(`${root}/`)) continue;
    const rel = h.path.slice(root.length + 1).split("/");
    let parent = root;
    for (let i = 0; i < rel.length; i++) {
      const path = `${parent}/${rel[i]}`;
      const leaf = i === rel.length - 1;
      const list = kids.get(parent) ?? [];
      if (!list.some((n) => n.path === path)) {
        list.push({ name: rel[i], path, hit: hitPaths.has(path),
          repo: leaf ? h.repo : false, wt: (leaf && h.wt) || isWtPath(path) });
        kids.set(parent, list);
      }
      if (!leaf) { open.add(path); partial.add(path); }
      parent = path;
    }
  }
  for (const list of kids.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  return { q, kids, open, partial, hits: hitPaths.size, truncated };
}

async function runFind(q: string) {
  const seq = ++pkFindSeq;
  const res = await api(dirsUrl(pkRoot, `&find=${encodeURIComponent(q)}`)).catch(() => null);
  if (!res || !res.ok || seq !== pkFindSeq || !pkShell?.isOpen()) return;
  const d = (await res.json().catch(() => null)) as
    { hits?: { path: string; name: string; repo: boolean; wt: boolean }[]; truncated?: boolean } | null;
  if (!d?.hits || seq !== pkFindSeq || !pkShell?.isOpen()) return;
  pkFind = buildFindTree(pkRoot, d.hits, q, !!d.truncated);
  paintPicker();
}

// typing is a filter FIRST (instant, on what is drawn) and a search SECOND (a round trip that
// reaches into the folders that are not). The two are not alternatives: the local pass keeps the
// window responsive per keystroke, the search replaces it a moment later with the deeper answer.
function scheduleFind() {
  const q = pkFilter.value.trim();
  if (pkFindTimer) clearTimeout(pkFindTimer);
  pkFindTimer = null;
  if (q.length < PK_FIND_MIN) {
    if (pkFind) { pkFind = null; pkFindSeq++; paintPicker(); }
    return;
  }
  pkFindTimer = setTimeout(() => { pkFindTimer = null; void runFind(q); }, 200);
}

function clearFind() {
  if (pkFindTimer) clearTimeout(pkFindTimer);
  pkFindTimer = null;
  pkFindSeq++;
  pkFind = null;
}

// the dotfolder toggle changes what every listing CONTAINS, so every listing already on screen has
// to be fetched again — keeping the folders the owner opened, which a plain browse() would drop
async function reloadTree() {
  const paths = [pkRoot, ...pkOpen];
  const lists = await Promise.all(paths.map((p) => fetchKids(p)));
  if (!pkShell?.isOpen()) return;
  paths.forEach((p, i) => {
    const kids = lists[i];
    if (kids) pkKids.set(p, kids);
    else { pkKids.delete(p); pkOpen.delete(p); } // gone or unreadable: stop claiming it is open
  });
  if (pkFind) await runFind(pkFind.q);
  else paintPicker();
}

// rebuild the whole list from cached state. Cheap — the expensive part is the fetch, which happens
// once per folder — and it keeps one painting path for browse(), expand, collapse and pin changes.
function paintPicker() {
  const shell = pkShell;
  if (!shell) return;
  const keep = pkFilter.value;
  shell.list.replaceChildren();
  pkRows = [];
  let head: HTMLElement | null = null;
  const addHead = (t: string, n?: number) => {
    head = el("div", "shellsec");
    head.appendChild(el("span", "shellsect", t));
    if (n !== undefined) head.appendChild(el("span", "shellsecn", String(n)));
    shell.list.appendChild(head);
  };
  const addRow = (o: DirRowOpts) => {
    const row = dirRow(o);
    shell.list.appendChild(row);
    pkRows.push({ row, path: o.path, name: `${o.label} ${o.sub ?? ""}`.toLowerCase(), head,
      wt: !!o.wt, way: o.find === "way" });
  };
  // the honest stand-in lines: "no subfolders", the listing cap, the search's own notes. They sit
  // where a row would sit at that depth — the stylesheet owns that geometry via --pkdepth.
  const addNote = (depth: number, text: string, cls = "") => {
    const n = el("div", `pknone tree${cls ? ` ${cls}` : ""}`);
    n.style.setProperty("--pkdepth", String(depth));
    n.textContent = text;
    shell.list.appendChild(n);
  };
  // full paths render as name-up-front + dimmed parent; a bare top-level dir (/tmp) still splits
  const split = (p: string): { leaf: string; sub: string } => {
    const disp = p.replace(/^\/Users\/[^/]+/, "~");
    const i = disp.lastIndexOf("/");
    if (i < 0) return { leaf: disp, sub: "" };
    if (i === 0) return { leaf: disp.slice(1) || disp, sub: "/" };
    return { leaf: disp.slice(i + 1), sub: disp.slice(0, i) };
  };
  // the shortcut sections stay FLAT: they are jump targets scattered across the disk, not places in
  // this tree, and drawing guide lines beside them would claim a nesting that does not exist
  if (pkShortcuts.pins.length) {
    addHead("Pinned", pkShortcuts.pins.length);
    for (const p of pkShortcuts.pins) {
      const { leaf, sub } = split(p);
      addRow({ label: leaf, sub, path: p, cls: "pin", icon: "star", wt: isWtPath(p) });
    }
  }
  if (pkShortcuts.recents.length) {
    addHead("Recent", pkShortcuts.recents.length);
    for (const r of pkShortcuts.recents) {
      const { leaf, sub } = split(r);
      addRow({ label: leaf, sub, path: r, cls: "recent", icon: "clock", wt: isWtPath(r) });
    }
  }
  addHead("Places");
  for (const c of pkShortcuts.common)
    addRow({ label: c.replace(/^\/Users\/[^/]+/, "~"), path: c, cls: "place", icon: "folder" });

  const roots = pkKidsOf(pkRoot);
  // in search mode the section counts MATCHES, not rows: the folders on the way to them are drawn
  // but are not what the query found (applyWtHide recomputes this from the rows and skips them too)
  addHead(pkFind ? `Matches for “${pkFind.q}”` : "Folders", pkFind ? pkFind.hits : roots.length);
  if (pkShortcuts.parent)
    addRow({ label: `Up to ${baseName(pkShortcuts.parent)}`, path: pkShortcuts.parent, cls: "up", icon: "up" });
  // `blanks` grows one entry per level as we descend: the flag says whether the ancestor at that
  // level was its parent's last child, and a spine below such an ancestor would draw a sibling that
  // does not exist.
  const emit = (parent: string, depth: number, blanks: boolean[]) => {
    const kids = pkKidsOf(parent);
    if (!kids.length && depth > 0) {
      // depth only — the stylesheet owns the geometry and lines this up with the names above it.
      // This was `61 + depth * 26`, a copy of the guide/▸/gap widths that no longer matched either
      // the desktop or the phone once those changed.
      addNote(depth, "no subfolders");
      return;
    }
    kids.forEach((n, i) => {
      const last = i === kids.length - 1;
      addRow({ label: n.name, path: n.path, cls: "dir", icon: "folder", repo: n.repo, wt: n.wt,
        depth, tree: true, blanks, last, find: pkFind ? (n.hit ? "hit" : "way") : undefined });
      if (pkIsOpen(n.path)) emit(n.path, depth + 1, [...blanks, last]);
    });
    // the cap, said out loud. Serving 200 of 1284 folders silently is indistinguishable on screen
    // from a folder that holds 200 — which is why nobody could tell it was happening.
    const total = !pkFind ? pkCap.get(parent) : undefined;
    if (total !== undefined) addNote(depth, `${kids.length} of ${total} — refine`, "pkcap");
  };
  emit(pkRoot, 0, []);
  // the search has a budget (depth, folders read, matches returned) and it says when it spent it,
  // so "no more results" is never reported as "no more matches" — the empty case most of all
  if (pkFind) {
    if (!pkFind.hits) addNote(0, pkFind.truncated
      ? `nothing called “${pkFind.q}” in the part of this tree the search reached — it stopped at its limit`
      : `nothing under this folder is called “${pkFind.q}”`);
    else if (pkFind.truncated) addNote(0, "…and more below this — the search stopped at its limit", "pkcap");
  } else if (!roots.length) shell.list.appendChild(el("div", "pknone", "no subfolders here"));
  applyWtHide(); // honor the current "hide lanes" toggle for the freshly built rows
  if (keep) { pkFilter.value = keep; applyPkFilter(); }
}

// --- what the highlighted folder actually is (GET /api/dirinfo) ---
// The old picker could say "this is a git repo" and nothing more, so telling two similarly-named
// checkouts apart meant opening a session in one to find out.
interface DirCommit { hash: string; ts: number; subject: string }
interface DirInfoResp {
  path: string; exists: boolean; git: boolean; worktree?: boolean; branch?: string | null;
  dirty?: number; ahead?: number | null; behind?: number | null;
  last?: DirCommit | null; recent?: DirCommit[];
  entries?: { name: string; dir: boolean }[]; entryTotal?: number; hidden?: number;
  lanes?: number; error?: string;
}
let pkInfoSeq = 0; // latest-wins: arrow-keying down a list outruns the fetches it starts

// A 404 on a route this page KNOWS about means one specific thing in Fleet, and it is worth saying
// out loud rather than spinning: `bun run build` publishes the client instantly (the server serves
// public/app.js off disk), while new server ROUTES only exist after srv restarts. So a freshly built
// dashboard talks to a pre-change server until someone kills the srv session — and every call to a
// route added in the same change 404s. That is exactly what an indefinite "reading…" was.
const SKEW_NOTE = "this page is newer than the server it is talking to — that route does not exist"
  + " there yet. Restart Fleet's srv session to pick up the new routes (the sessions survive it).";

// what the detail pane is currently able to say. A pane that can only render "loading" and "loaded"
// has no way to stop loading, which is the whole defect: showDirDetail returned early on a failed
// fetch and left the placeholder on screen forever.
type DirLoad = { st: "loading" } | { st: "ok"; info: DirInfoResp } | { st: "fail"; why: string };

// the folder the detail pane is currently describing — so a late-arriving harness catalogue can
// repaint the pane it belongs to, instead of the options row appearing only on the NEXT click
let pkDetailPath: string | null = null;

async function showDirDetail(path: string) {
  const shell = pkShell;
  if (!shell) return;
  pkDetailPath = path;
  const seq = ++pkInfoSeq;
  renderDirDetail(path, { st: "loading" });
  const done = (load: DirLoad) => {
    // a superseded fetch must not paint over the row the cursor has since moved to
    if (shell.isOpen() && seq === pkInfoSeq) renderDirDetail(path, load);
  };
  const res = await api(`/api/dirinfo?path=${encodeURIComponent(path)}`).catch(() => null);
  if (!res) { done({ st: "fail", why: "couldn't reach the server — retry, or check the connection" }); return; }
  if (res.status === 404) { done({ st: "fail", why: SKEW_NOTE }); return; }
  if (!res.ok) { done({ st: "fail", why: `the server answered ${res.status} for this folder` }); return; }
  const info = (await res.json().catch(() => null)) as DirInfoResp | null;
  done(info ? { st: "ok", info } : { st: "fail", why: "the server's answer was not readable JSON" });
}

// What the NEXT session started from this picker will be spawned as. Held here rather than read
// off the DOM at click time because the detail pane is re-rendered on every dir load, and a
// choice that survives re-render but not a click would be the worst of both.
// Reset per picker OPEN (openPicker), not per directory: picking a harness and then browsing to
// the folder you want it in is the normal order of doing this.
let spawnHarness: string | null = null;
let spawnModel = "";
let spawnEffort = "";
let spawnContainer = "";
let spawnContainerContext = "";

// The spawn-options row — the first spawn-options UI in this app at all. Two things it closes at
// once: choosing a harness (which never existed), and sending `model`, which the server routes
// have accepted since long before this and no client call ever sent.
//
// The quick paths (⎇+ quicklane, ⌘Enter) deliberately do NOT read any of this: they stay
// one-click on defaults. Only the two buttons in THIS pane carry the options.
// `before`: the node to insert AHEAD of, or null for "append at the end". It exists because the
// first call and the re-render after a harness change happen at different moments in the pane's
// life. On the first call `host` ends at the buttons, so appending puts the row directly under
// them; by the time a harness change re-renders, the whole rest of the pane is already there, so
// appending would drop the row below the facts and the directory listing — far out of view. The
// owner read that as the controls disappearing (2026-08-10), which is exactly what it looks like.
function appendSpawnOptions(host: HTMLElement, before: Node | null = null): void {
  // empty catalogue (not fetched yet, or the fetch failed) → render nothing at all. The pane is
  // then exactly the pre-harness pane, and both buttons still work on defaults.
  const agents = agentHarnesses();
  if (agents.length < 2) return;
  const row = el("div", "pkdopts");

  const hSel = el("select", "pkdsel") as HTMLSelectElement;
  for (const h of agents) {
    const o = el("option", "", h.default ? `${h.id} (default)` : h.id) as HTMLOptionElement;
    o.value = h.id;
    if ((spawnHarness ?? agents.find((x) => x.default)?.id) === h.id) o.selected = true;
    hSel.appendChild(o);
  }
  row.appendChild(labelled("harness", hSel));

  const chosen = agents.find((h) => h.id === hSel.value) ?? agents.find((h) => h.default);

  const mIn = el("input", "pkdin") as HTMLInputElement;
  mIn.type = "text";
  // the DEFAULT is only knowable for the default adapter — the server publishes exactly one
  // value and says it is Claude-only. For a foreign harness the honest placeholder is the word
  // "default", never this id: claiming it there would be a fact the server never asserted.
  mIn.placeholder = chosen?.default && defaultModel ? defaultModel : "default";
  mIn.value = spawnModel;
  mIn.oninput = () => { spawnModel = mIn.value.trim(); };
  if (chosen?.supports.model) row.appendChild(labelled("model", mIn));

  // effort only exists for a harness that HAS the concept — the row simply does not offer it
  // otherwise, which is the visible degradation: no dead control that silently does nothing.
  if (chosen?.supports.effort && chosen.effortLevels.length) {
    const eSel = el("select", "pkdsel") as HTMLSelectElement;
    for (const lv of ["", ...chosen.effortLevels]) {
      const o = el("option", "", lv || "default") as HTMLOptionElement;
      o.value = lv;
      if (spawnEffort === lv) o.selected = true;
      eSel.appendChild(o);
    }
    eSel.onchange = () => { spawnEffort = eSel.value; };
    row.appendChild(labelled("effort", eSel));
  }

  // the box: which container, and on which docker daemon. Only for a harness that runs in one —
  // the same visible degradation as effort. Empty means the fleet default (the placeholder says
  // which), never docker's ambient context. The two belong together: an IMAGE lives in exactly one
  // daemon, so a context without this container's image is a pane full of docker's own error.
  if (chosen?.supports.container) {
    const cIn = el("input", "pkdin") as HTMLInputElement;
    cIn.type = "text";
    cIn.placeholder = containerDefaults?.container ?? "container";
    cIn.value = spawnContainer;
    cIn.oninput = () => { spawnContainer = cIn.value.trim(); };
    row.appendChild(labelled("container", cIn));

    const xIn = el("input", "pkdin") as HTMLInputElement;
    xIn.type = "text";
    xIn.placeholder = containerDefaults?.containerContext ?? "docker context";
    xIn.value = spawnContainerContext;
    xIn.title = "which docker daemon — an image lives in exactly one, so this must be the context the"
      + " container's image was built in";
    xIn.oninput = () => { spawnContainerContext = xIn.value.trim(); };
    row.appendChild(labelled("docker context", xIn));
  }

  hSel.onchange = () => {
    // read from the SAME list the dropdown was built from — a place is not selectable, so looking
    // it up in the unfiltered catalogue could only ever find something this control cannot show
    const next = agents.find((h) => h.id === hSel.value);
    spawnHarness = next && !next.default ? next.id : null;
    // a level from the harness being left behind must not ride along to the next one
    if (!next?.supports.effort || !next.effortLevels.includes(spawnEffort)) spawnEffort = "";
    if (!next?.supports.model) spawnModel = "";
    // ...and a box must not either: the server refuses one for a harness without the concept, so
    // carrying it over would turn a harness change into a 400 the owner cannot see the cause of
    if (!next?.supports.container) { spawnContainer = ""; spawnContainerContext = ""; }
    renderSpawnOptions(host, row);
  };

  host.insertBefore(row, before);
  // the caveat a harness states about ITSELF, shown before it is ever spawned rather than
  // discovered afterwards — for Pi that is the shape of its write fence, and what the fence does
  // NOT cover (reads, network), which is the half an owner has to weigh before picking it.
  if (chosen?.note) host.insertBefore(el("div", "pkdwarn", `${chosen.id}: ${chosen.note}`), before);
}

// re-render the row in place after a harness change (the fields on offer depend on it)
function renderSpawnOptions(host: HTMLElement, old: HTMLElement): void {
  const note = old.nextElementSibling;
  const warn = note?.classList.contains("pkdwarn") ? note : null;
  // the anchor is read BEFORE either removal, so the rebuilt row goes back exactly where this one
  // stood instead of at the end of a pane that has since been filled in
  const anchor = (warn ?? old).nextSibling;
  warn?.remove();
  old.remove();
  appendSpawnOptions(host, anchor);
}

function labelled(text: string, control: HTMLElement): HTMLElement {
  const wrap = el("label", "pkdopt");
  wrap.appendChild(el("span", "pkdoptl", text));
  wrap.appendChild(control);
  return wrap;
}

// the options every spawn from this pane carries. Absent fields mean "the default", which is
// exactly what the server reads them as.
function spawnBody(): { harness?: string; model?: string; effort?: string; container?: string; containerContext?: string } {
  return {
    ...(spawnHarness ? { harness: spawnHarness } : {}),
    ...(spawnModel ? { model: spawnModel } : {}),
    ...(spawnEffort ? { effort: spawnEffort } : {}),
    ...(spawnContainer ? { container: spawnContainer } : {}),
    ...(spawnContainerContext ? { containerContext: spawnContainerContext } : {}),
  };
}

function renderDirDetail(path: string, load: DirLoad) {
  const shell = pkShell;
  if (!shell) return;
  const info = load.st === "ok" ? load.info : null;
  shell.detail.replaceChildren();
  shell.detail.appendChild(el("div", "rvhead", baseName(path)));
  shell.detail.appendChild(el("div", "pkdpath", path.replace(/^\/Users\/[^/]+/, "~")));

  // a slot already sitting in this folder is the single most useful thing to know before starting
  // another one there — Fleet will happily open two sessions on the same tree
  const open = fleet.filter((s) => s.cwd === path);
  if (open.length) {
    const who = open.map((s) => `slot ${s.id}${s.label ? ` (${s.label})` : ""}`).join(", ");
    shell.detail.appendChild(el("div", "pkdwarn", `already open in ${who}`));
  }

  const acts = el("div", "pkdacts");
  const start = el("button", "shrbtn primary", "Start session here") as HTMLButtonElement;
  start.onclick = () => void startSession(path);
  acts.appendChild(start);
  if (info?.git && !info.worktree) {
    const lane = el("button", "shrbtn", "⎇ New lane here") as HTMLButtonElement;
    lane.title = "create a git worktree (lane) in this repo and open a session in it";
    lane.onclick = () => void startWorktree(path);
    acts.appendChild(lane);
  }
  shell.detail.appendChild(acts);
  appendSpawnOptions(shell.detail);

  if (load.st === "loading") { shell.detail.appendChild(el("div", "shellhint", "reading…")); return; }
  if (load.st === "fail") { shell.detail.appendChild(el("div", "diffstat err", load.why)); return; }
  if (!info) return; // unreachable: st === "ok" carries one
  if (info.error) { shell.detail.appendChild(el("div", "diffstat err", info.error)); return; }
  if (!info.exists) {
    shell.detail.appendChild(el("div", "diffstat err", "this folder no longer exists"));
    return;
  }
  if (!info.git) {
    shell.detail.appendChild(el("div", "shellhint",
      "not a git repo — a session here works fine, there is just nothing to branch, diff or land"));
    appendDirContents(shell.detail, info);
    return;
  }

  const facts = el("div", "ocfacts");
  facts.appendChild(chip(info.branch ?? "detached HEAD", info.branch ? "" : "warn"));
  if (info.worktree) facts.appendChild(chip("⎇ this is a lane", "",
    "a git worktree, not the primary checkout — Fleet lanes live in <repo>.worktrees/"));
  facts.appendChild(info.dirty
    ? chip(`${info.dirty} uncommitted`, "warn")
    : chip("clean tree", "ok"));
  // ABSENT is not zero: a branch with no upstream has nothing to be ahead OF, and rendering 0/0
  // would state a comparison that was never made
  if (typeof info.ahead === "number" && typeof info.behind === "number")
    facts.appendChild(chip(`↑${info.ahead} ↓${info.behind}`, info.ahead ? "warn" : "",
      "commits ahead of / behind the upstream branch"));
  else facts.appendChild(chip("no upstream", "dim",
    "this branch tracks nothing, so there is no ahead/behind to report — not a measured zero"));
  if (info.lanes) facts.appendChild(chip(`${info.lanes} lane${info.lanes === 1 ? "" : "s"}`, "",
    "Fleet worktrees forked from this repo, in <repo>.worktrees/"));
  shell.detail.appendChild(facts);

  appendDirContents(shell.detail, info);

  // `recent` is a newer field than this route: a client built ahead of the server it talks to gets
  // `last` alone, and one commit is what it can honestly show — not a padded list of one.
  const commits = info.recent ?? (info.last ? [info.last] : []);
  const sec = el("div", "shellsec");
  sec.appendChild(el("span", "shellsect", "Recent commits"));
  if (commits.length) sec.appendChild(el("span", "shellsecn", String(commits.length)));
  shell.detail.appendChild(sec);
  if (!commits.length) {
    shell.detail.appendChild(el("div", "shellhint", "no commits yet in this repo"));
    return;
  }
  for (const c of commits) {
    const row = el("div", "pkdcommit");
    row.appendChild(el("div", "pkdlast", c.subject));
    row.appendChild(el("div", "diffstat", `${c.hash} · ${fmtTs(c.ts)}`));
    shell.detail.appendChild(row);
  }
  // says what this list is NOT, so nobody reads five subjects as the repo's history: the audit
  // trail and the activity window's commits lens are where the full record lives.
  shell.detail.appendChild(el("div", "shellhint",
    `the newest ${commits.length} — a glance at what this repo has been doing, not its history.`
    + " The activity window's Commits lens carries the full list."));
}

// the folder's own children. This is the thing the pane was missing: a branch name and a commit
// subject do not tell two similarly-named checkouts apart, and their contents do at one glance.
// --- Contents: a tree you open IN PLACE, not a listing that sends you somewhere -----------------
//
// This list used to be one flat level, and a folder in it RE-ROOTED the tree on the left — you
// asked what is in a folder and the whole window moved. Now it opens where it stands, with the
// same guides, elbows and descender the left tree uses, so nesting is drawn rather than implied.
// Its expansion state is its OWN: the left tree answers "where do I want to work", this answers
// "what is in this project", and neither is a view of the other.
interface DirEntry { name: string; dir: boolean }
let pkdRoot = "";                                     // the folder this pane is showing
let pkdBox: HTMLElement | null = null;                // the element to repaint on expand/collapse
let pkdInfo: DirInfoResp | null = null;
const pkdOpen = new Set<string>();
const pkdKids = new Map<string, DirEntry[] | null>(); // null = read, and unreadable
const pkdBusy = new Set<string>();

// entries (files AND folders) for any path. /api/dirs is folders-only, which is right for the
// left tree and useless here. No new route: this keeps the whole change client-side, so it goes
// live on `bun run build` without an srv restart.
async function fetchEntries(path: string): Promise<DirEntry[] | null> {
  const res = await api(`/api/dirinfo?path=${encodeURIComponent(path)}`).catch(() => null);
  if (!res || !res.ok) return null;
  const d = (await res.json().catch(() => null)) as DirInfoResp | null;
  return d?.entries ?? null;
}

async function toggleContents(path: string) {
  if (pkdOpen.has(path)) { pkdOpen.delete(path); paintContents(); return; }
  if (!pkdKids.has(path)) {
    if (pkdBusy.has(path)) return;
    pkdBusy.add(path);
    paintContents();                                  // the row says it is working
    const kids = await fetchEntries(path);
    pkdBusy.delete(path);
    // an unreadable folder caches as null rather than retrying on every click — the row then says
    // so, which is the same bargain the left tree makes
    pkdKids.set(path, kids);
  }
  pkdOpen.add(path);
  paintContents();
}

function contentsRow(e: DirEntry, path: string, depth: number, blanks: boolean[], last: boolean,
                     rootPath: string): HTMLElement {
  const open = e.dir && pkdOpen.has(path);
  const row = el("div", `pkdent${e.dir ? " dir" : ""}${open ? " open" : ""}`);
  row.title = path;
  const lead = el("span", "pklead");
  for (let i = 0; i <= depth; i++) {
    const g = el("span", "pkguide");
    if (i === depth) g.classList.add(last ? "end" : "branch");
    else if (blanks[i]) g.classList.add("blank");
    lead.appendChild(g);
  }
  // a FILE reserves the same column the ▸ occupies. It has nothing to expand, but taking the
  // column away would step every filename left of its sibling folders and undo the alignment the
  // guides just established.
  const tw = el("span", `pktw${open ? " open" : ""}`,
    e.dir ? (pkdBusy.has(path) ? "·" : open ? "▾" : "▸") : "");
  if (e.dir) {
    tw.title = open ? "collapse" : "expand";
    tw.onclick = (ev) => { ev.stopPropagation(); void toggleContents(path); };
  }
  lead.appendChild(tw);
  row.appendChild(lead);
  row.appendChild(pkIcon(e.dir ? (open ? "folderOpen" : "folder") : "file"));
  row.appendChild(el("span", "pkdname", e.name + (e.dir ? "/" : "")));
  if (e.dir) {
    // re-rooting the left tree was what a click did here, and it is still worth having — it just
    // stops being what happens when you only wanted to look inside.
    const go = el("span", "pkdgo", "↗");
    go.title = `make ${e.name}/ the top of the tree on the left`;
    go.onclick = (ev) => { ev.stopPropagation(); void browse(path); };
    row.appendChild(go);
    row.onclick = () => void toggleContents(path);
  } else {
    row.onclick = () => {
      const shell = pkShell;
      if (!shell) return;
      showFileView(shell, {
        path, label: e.name,
        source: "as it is on disk right now",
        back: { label: baseName(rootPath), go: () => void showDirDetail(rootPath) },
      });
    };
  }
  return row;
}

function paintContents() {
  const box = pkdBox;
  const info = pkdInfo;
  if (!box || !info) return;
  box.replaceChildren();
  // Nothing expanded means every row is a sibling of every other, and siblings do not need to be
  // stacked in one column down the middle of a wide pane — the stylesheet lays them out as a grid.
  // Expanding anything ends that: nesting reads top-to-bottom, and a grid would break a subtree
  // across a column boundary, away from the parent whose guide line claims it.
  box.classList.toggle("flat", pkdOpen.size === 0);
  const emit = (path: string, depth: number, blanks: boolean[]) => {
    const kids = pkdKids.get(path);
    if (kids === null) {
      const bad = el("div", "pknone tree", "could not be read — that is a permissions answer");
      bad.style.setProperty("--pkdepth", String(depth));
      box.appendChild(bad);
      return;
    }
    if (!kids) return;
    if (!kids.length) {
      const none = el("div", "pknone tree", "empty");
      none.style.setProperty("--pkdepth", String(depth));
      box.appendChild(none);
      return;
    }
    kids.forEach((e, i) => {
      const last = i === kids.length - 1;
      const full = `${path}/${e.name}`;
      box.appendChild(contentsRow(e, full, depth, blanks, last, info.path));
      if (e.dir && pkdOpen.has(full)) emit(full, depth + 1, [...blanks, last]);
    });
  };
  emit(info.path, 0, []);
}

function appendDirContents(target: HTMLElement, info: DirInfoResp) {
  const sec = el("div", "shellsec");
  sec.appendChild(el("span", "shellsect", "Contents"));
  const entries = info.entries;
  if (entries === undefined) {
    target.appendChild(sec);
    target.appendChild(el("div", "shellhint",
      "this folder's contents could not be read — that is a permissions answer, not an empty folder"));
    return;
  }
  // counted over what was actually LISTED. A capped listing says so instead of splitting a total it
  // only partly saw — the entries sort folders first, so the unlisted tail is not a known mix.
  const dirs = entries.filter((e) => e.dir).length;
  const files = entries.length - dirs;
  const total = info.entryTotal ?? entries.length;
  const parts = [`${dirs} folder${dirs === 1 ? "" : "s"}`, `${files} file${files === 1 ? "" : "s"}`];
  if (total > entries.length) parts.unshift(`${entries.length} of ${total}`);
  if (info.hidden) parts.push(`${info.hidden} hidden`);
  sec.appendChild(el("span", "shellsecn", parts.join(" · ")));
  target.appendChild(sec);
  if (!entries.length) {
    target.appendChild(el("div", "shellhint",
      info.hidden ? "nothing here but dot-entries — the folder is not empty, its contents are all hidden"
        : "this folder is empty"));
    return;
  }
  // switching to a DIFFERENT folder starts a fresh tree; re-rendering the same one (the pane
  // repaints on every selection) keeps whatever the reader has opened
  if (info.path !== pkdRoot) { pkdRoot = info.path; pkdOpen.clear(); pkdKids.clear(); pkdBusy.clear(); }
  pkdKids.set(info.path, entries);
  pkdInfo = info;
  pkdBox = el("div", "pkdtree");
  paintContents();
  target.appendChild(pkdBox);
}

// --- the file view: one renderer for every file list in the app ---------------------------------
//
// Four surfaces list files and none of them could open one: the picker's Contents, a commit's
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
  back: { label: string; go: () => void };
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
  const back = el("button", "fvback", `‹ ${o.back.label}`);
  back.onclick = () => o.back.go();
  shell.detail.appendChild(back);
  shell.detail.appendChild(el("div", "rvhead", o.label));
  shell.detail.appendChild(el("div", "pkdpath", o.path.replace(/^\/Users\/[^/]+/, "~")));
  shell.detail.appendChild(el("div", "fvsource", o.source));
  const body = el("div", "fvbody");

  // the "view option": where a change EXISTS, it is the default — a file in a commit is interesting
  // for what the commit did to it. The whole file is one click away, never the other way round.
  let tab: "change" | "file" = o.diff ? "change" : "file";
  const tabs = el("div", "actlens");
  const paint = () => {
    for (const b of Array.from(tabs.children)) b.classList.toggle("active",
      (b as HTMLElement).dataset.tab === tab);
    body.replaceChildren();
    if (tab === "change" && o.diff) {
      const box = el("div", "difftxt");
      renderDiffInto(box, o.diff);
      body.appendChild(box);
      return;
    }
    body.appendChild(el("div", "shellhint", "reading the file…"));
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

async function loadFile(o: FileViewOpts): Promise<FileResp | null> {
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
    body.appendChild(el("div", "shellhint",
      "this is a binary file — there is nothing to read as text, and showing the decode would be"
      + " noise, not content"));
    return;
  }
  const text = r.text ?? "";
  if (!text && !r.hash) { body.appendChild(el("div", "shellhint", "this file is empty")); return; }
  // EVERY file is shown as its own text, .md included. The tempting move is to run mdInto over
  // markdown — it has rendered real structure since 2026-09-11 and would look good here — and it
  // would still be wrong: a viewer is for reading what the file SAYS, and a rendered heading hides
  // the `##` that is the actual byte on disk. The chat view renders because a transcript is a
  // conversation; this one does not because a file is a source.
  const pre = el("div", "fvtext");
  pre.textContent = text || "(this file is empty)";
  body.appendChild(pre);
  const facts: string[] = [];
  if (typeof r.size === "number") facts.push(`${(r.size / 1024).toFixed(1)} KB`);
  facts.push(`${text.split("\n").length} lines`);
  body.appendChild(el("div", "diffstat", facts.join(" · ")));
  if (r.truncated) body.appendChild(el("div", "ocwarn",
    "this file is longer than the viewer serves — what is above is the beginning of it, not all of it"));
  // ── the third step of the stair: read → understand → change ────────────────────────────────
  // Editing is a SEPARATE click and always was the requirement ("Bearbeiten erst nach extra
  // Klick"). Nothing above changes when this button is absent, which is the normal case: a commit's
  // revision, a file the server declined to hand an editable hash for, a caller that named no slot.
  if (!o.edit) return;
  if (!r.hash) {
    if (r.noEdit) body.appendChild(el("div", "shellhint", `not editable here — ${r.noEdit}`));
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

// pin/unpin round-trips to the server (pins follow the owner across devices), then re-renders
async function togglePin(path: string) {
  const res = await post("/api/pins", { path, on: !pkPins.has(path) });
  if (!res.ok) return;
  const data = (await res.json()) as { pins?: string[] };
  pkPins = new Set(data.pins ?? []);
  const keepFilter = pkFilter.value; // browse() clears it — restore so ⌘D-pin keeps your context
  await browse(pkPathIn.value); // rebuild the Pinned section + star states from the new set
  // browse() drops the search with the root it belonged to; the query is back on screen, so the
  // search it stands for has to come back too, or the box would describe a list it no longer made
  if (keepFilter) { pkFilter.value = keepFilter; applyPkFilter(); scheduleFind(); }
}

async function startSession(path: string) {
  if (!pickerSlot) return;
  const slot = pickerSlot;
  const res = await post(`/api/slots/${slot}/open`, { cwd: path, ...spawnBody() });
  if (!res.ok) {
    // the options row can now make this fail for a reason the path field cannot express (an
    // unknown harness, a model the chosen harness rejects) — say which, instead of only
    // flashing the path box red as if the folder were at fault
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    pkPathIn.classList.add("bad");
    setTimeout(() => pkPathIn.classList.remove("bad"), 1200);
    if (err.error) alert(`Session failed: ${err.error}`);
    return;
  }
  closePicker();
  await refresh();
  showSlot(slot);
}

async function startWorktree(repo: string) {
  if (!pickerSlot) return;
  const slot = pickerSlot;
  const chosen = harnesses.find((h) => h.id === spawnHarness)
    ?? harnesses.find((h) => h.default);
  if (chosen?.allowsLanes === false) {
    alert(`${chosen.id} is main-session only — choose “Start session here”, not a lane.`);
    return;
  }
  // branch names are plumbing, not something to type: the server auto-names the lane
  // (fleet/<stamp>-<rand>) and the slot label is what you actually rename
  const res = await post(`/api/slots/${slot}/open-worktree`, { repo, branch: "", ...spawnBody() });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    pkPathIn.classList.add("bad");
    setTimeout(() => pkPathIn.classList.remove("bad"), 1200);
    if (err.error) alert(`Lane failed: ${err.error}`);
    return;
  }
  closePicker();
  await refresh();
  showSlot(slot);
}

function openPicker(slotId: number) {
  setDrawer(false);
  pkShell?.close();
  pickerSlot = slotId;
  // a fresh picker is a fresh decision: the previous session's harness/model/effort must not be
  // inherited by whatever this slot becomes next (the server clears the same three on recycle).
  spawnHarness = null; spawnModel = ""; spawnEffort = ""; spawnContainer = ""; spawnContainerContext = "";
  pkDetailPath = null;
  // fetch-once, and only from here: the catalogue is needed exactly when a spawn is being
  // composed, so it never costs anything on a board that is only being watched.
  void loadHarnesses().then(() => {
    if (pkShell?.isOpen() && pkDetailPath) void showDirDetail(pkDetailPath);
  });
  const shell = openShell({
    id: "picker",
    title: `New session — slot ${slotId}`,
    listWidth: 460,
    onSelect: (row) => {
      const hit = pkRows.find((r) => r.row === row.el);
      if (hit) void showDirDetail(hit.path);
    },
    onClose: () => { pickerSlot = 0; pkShell = null; pkRows = []; },
  });
  pkShell = shell;

  // --- the window's controls. Line 1 is the fast path (filter + lane toggle); the breadcrumb and
  // the type-a-path box wrap onto line 2, where they are navigation rather than the common case.
  pkFilter = el("input", "pkfilterin") as HTMLInputElement;
  pkFilter.type = "text";
  pkFilter.spellcheck = false;
  pkFilter.autocomplete = "off";
  // a phone has no ⌘, no double-click idiom and no arrow keys: the desktop legend is not a shorter
  // version of the truth there, it is the wrong instructions
  pkFilter.placeholder = isMobile()
    ? "search folders — subfolders too"
    : "search — subfolders too · ↑↓ select · ⌘Enter start · Enter re-root · ⌘D pin";
  pkHideBtn = el("button", "pktoggle") as HTMLButtonElement;
  pkHideBtn.onclick = () => {
    hideWorktrees = !hideWorktrees;
    localStorage.setItem("fleet.hidewt", hideWorktrees ? "1" : "0");
    renderHideWtBtn();
    applyWtHide();
  };
  renderHideWtBtn();
  // the lane toggle is a VIEW filter — the rows are there and get a class. This one is not: what a
  // listing contains is decided on the server, so flipping it has to fetch the tree again.
  pkDotBtn = el("button", "pktoggle") as HTMLButtonElement;
  pkDotBtn.onclick = () => {
    showHidden = !showHidden;
    localStorage.setItem("fleet.pkdot", showHidden ? "1" : "0");
    renderDotBtn();
    void reloadTree();
  };
  renderDotBtn();
  pkCrumb = el("div", "pkcrumb");
  pkCrumb.setAttribute("aria-label", "current location");
  pkPathIn = el("input", "pkpathin") as HTMLInputElement;
  pkPathIn.type = "text";
  pkPathIn.spellcheck = false;
  pkPathIn.autocomplete = "off";
  pkPathIn.placeholder = "or type a path";
  pkPathIn.dataset.ownEnter = "1"; // Enter here goes to what was TYPED, not to the selected row
  const line2 = el("div", "pkline2");
  line2.append(pkCrumb, pkPathIn);
  shell.tools.append(pkFilter, pkHideBtn, pkDotBtn, line2);

  pkFilter.addEventListener("input", () => { applyPkFilter(); scheduleFind(); });
  pkPathIn.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    void browse(pkPathIn.value);
  });
  // ⌘Enter starts, ⌘D pins. Both ride on the shell root: the shell skips modified Enter precisely
  // so a view can claim it, and it never binds plain letters at all.
  shell.root.addEventListener("keydown", (e) => {
    const target = () => {
      const i = shell.selectedIndex();
      const vis = pkVisible();
      return i >= 0 && vis[i] ? vis[i].path : pkPathIn.value;
    };
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void startSession(target()); return; }
    if ((e.metaKey || e.ctrlKey) && (e.key === "d" || e.key === "D")) { e.preventDefault(); void togglePin(target()); }
    // →/← walk the tree. Only on tree rows: a shortcut row has no children to open, and swallowing
    // the arrows inside the filter box would break moving the caret through what you typed.
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = shell.selectedIndex();
    const hit = i >= 0 ? pkVisible()[i] : undefined;
    if (!hit || !hit.row.classList.contains("tree")) return;
    if ((e.target as HTMLElement | null)?.tagName === "INPUT" && pkFilter.value) return;
    e.preventDefault();
    if (e.key === "ArrowRight") { if (!pkIsOpen(hit.path)) void toggleNode(hit.path); }
    else if (pkIsOpen(hit.path)) void toggleNode(hit.path);
  });

  shell.foot.textContent = isMobile()
    ? "tap ▸ to open a folder in place · tap its name for what is inside it · “start ▸” opens a"
      + " session there · ‹ goes back"
    : "click selects and opens · double-click (or ⌘Enter) starts a session here"
      + " · →/← expand and collapse · Enter re-roots the tree · ⌘D pins";

  const last = localStorage.getItem("fleet.pkdir") ?? "~";
  void browse(last).then(async (ok) => {
    if (!ok && last !== "~") await browse("~"); // remembered dir may have been deleted
    // focusing an input on mobile would pop the keyboard over the folder list
    if (!isMobile()) pkFilter.focus();
  });
}

// --- sidebar ---
function baseName(p: string) {
  const parts = p.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || "/";
}

// "this slot holds a session" as a type, so the row builders below never have to assert it
type ActiveSlot = SlotInfo & { cwd: string };
const isActive = (s: SlotInfo): s is ActiveSlot => !!s.cwd;

// A lane's spoken identity is the shortest suffix that separates it from every other active lane.
// Pure and DOM-free so the rule can be exercised directly. Lengths advance as collision groups,
// never by input order; sorting by id also makes iteration of the returned map deterministic.
function laneBranchRefs(lanes: readonly { id: number; branch: string }[]): Map<number, string> {
  const ordered = [...lanes].sort((a, b) => a.id - b.id);
  const lengths = new Map(ordered.map((lane) => [lane.id, Math.min(4, lane.branch.length)]));
  while (true) {
    const groups = new Map<string, typeof ordered>();
    for (const lane of ordered) {
      const length = lengths.get(lane.id) ?? 0;
      const ref = lane.branch.slice(-length);
      const group = groups.get(ref) ?? [];
      group.push(lane);
      groups.set(ref, group);
    }
    let lengthened = false;
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      for (const lane of group) {
        const length = lengths.get(lane.id) ?? 0;
        if (length >= lane.branch.length) continue;
        lengths.set(lane.id, length + 1);
        lengthened = true;
      }
    }
    // No movement is possible only for duplicate full branch strings. Returning those full strings
    // is the honest representation; every pair of distinct full branch strings separates first.
    if (!lengthened) break;
  }
  return new Map(ordered.map((lane) => {
    const length = lengths.get(lane.id) ?? 0;
    return [lane.id, lane.branch.slice(-length)] as const;
  }));
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
// the muddy yellow-brown band that turns grey against #141414.
const PROJECT_HUES = [8, 45, 88, 135, 175, 205, 260, 315];
function projectHue(path: string): number {
  let h = 0x811c9dc5; // FNV-1a
  for (let i = 0; i < path.length; i++) {
    h ^= path.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return PROJECT_HUES[(h >>> 0) % PROJECT_HUES.length];
}
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
// what is unfolded. Default is CLOSED — the point of the feature is the folded overview.
const STACK_LS = "fleet.stacks";
const stackOpen = new Set<string>(((): string[] => {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(STACK_LS) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch { return []; }
})());
function setStackOpen(g: Stack, on: boolean) {
  if (on) stackOpen.add(g.foldKey);
  else stackOpen.delete(g.foldKey);
  localStorage.setItem(STACK_LS, JSON.stringify([...stackOpen]));
  renderSlots();
}

// Which stacks exist right now. A repo with no lanes is NOT a stack — a lone session stays the
// plain row it always was, and nothing gets a fold arrow that has nothing to fold. More than one
// main in a repo can each own lanes, so the result is a list rather than one repo-keyed bucket.
function stacksOf(): Stack[] {
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

function startRename(row: HTMLElement, s: SlotInfo) {
  // dblclick on a not-yet-focused slot: the first click's assign() rebuilds the sidebar,
  // so the dblclick lands on the detached old row — a rename input there would be invisible.
  // Re-target the live row for this slot instead of silently doing nothing.
  if (!row.isConnected) {
    // rows are keyed by slot id, not index — the sidebar only lists ACTIVE slots now
    const live = slotsEl.querySelector(`[data-slot="${s.id}"]`);
    if (!(live instanceof HTMLElement)) return;
    row = live;
  }
  const lbl = row.querySelector(".lbl");
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
    codexpanel.appendChild(el("div", "shrhint", "Reading Codex conversation identities…"));
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
      codexpanel.appendChild(el("div", "shrhint", count === 0
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
        codexpanel.appendChild(el("div", "shrhint", `Showing the newest ${data.candidates.length} of ${count}.`));
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

function renderSlots() {
  updateTitle();
  // harness-dependent pane affordances follow the POLL, not just pane assignment: a session
  // started from another device (or another tab) changes what its slot can do, and a 💬 that
  // only re-decides on click would keep offering a conversation view that has nothing behind it.
  for (const p of panes) p.syncHarnessAffordances();
  if (slotsEl.querySelector(".renamein")) return; // never destroy an in-progress rename
  slotsEl.replaceChildren();
  // Every slot still gets a row and empty slots still hold their place — but a lane whose project
  // has a home in this list now renders under it instead of at its own number. The "slots are fixed
  // places" principle is bent HERE and only here, deliberately (§F3 edge 3): four sessions plus
  // twelve empty rows overflowed a phone screen, and folding the lanes is what buys that back.
  // Empty rows do not move, so "start a session in slot 7" still means the same place.
  const stacks = stacksOf();
  const refs = laneBranchRefs(fleet.flatMap((s) => isActive(s) && s.worktree
    ? [{ id: s.id, branch: s.worktree.branch }] : []));
  const stackAt = new Map(stacks.map((g) => [g.at, g]));
  const stackedLanes = new Set(stacks.flatMap((g) => g.lanes.map((lane) => lane.id)));
  for (const s of fleet) {
    if (!isActive(s)) { slotsEl.appendChild(emptyRow(s)); continue; }
    const g = stackAt.get(s.id);
    if (g) { renderStack(g, refs); continue; }
    if (stackedLanes.has(s.id)) continue; // folded (or drawn) under its persisted anchor/header
    slotsEl.appendChild(slotRow(s, undefined, refs)); // plain session, including another main with no lanes
  }
}

function emptyRow(s: SlotInfo): HTMLElement {
  const row = el("div", "slot empty");
  row.dataset.slot = String(s.id);
  row.appendChild(el("span", "n", String(s.id)));
  row.appendChild(el("span", "lbl dim", "empty"));
  row.onclick = () => openPicker(s.id);
  // The ⎇+ quick-lane chip used to hang here, on EVERY empty row — twelve identical chips the
  // moment a repo session had focus, none of them saying which repo they meant. It lives on the
  // stack anchor now (see slotRow), where the repo is named right next to it.
  return row;
}

// The whole stack: its anchor row and, when unfolded, its active lane rows.
function renderStack(g: Stack, refs: ReadonlyMap<number, string>) {
  const open = stackOpen.has(g.foldKey);
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
  row.appendChild(foldArrow(g, open));
  const lbl = el("span", "lbl dim", baseName(g.key));
  lbl.title = `${g.key}\nno matching anchored main session — orphan/parentless lanes`;
  row.appendChild(lbl);
  for (const c of stackChips(g, open)) row.appendChild(c);
  row.appendChild(quickLaneChip(g.key));
  row.onclick = () => setStackOpen(g, !open);
  return row;
}

function quickLaneChip(repo: string, parent?: LaneAnchor): HTMLElement {
  const q = el("span", "quicklane", "⎇+");
  q.title = `new lane in ${baseName(repo)} — one click, no picker`;
  q.onclick = (e) => { e.stopPropagation(); void newLane(repo, parent); };
  return q;
}

function foldArrow(g: Stack, open: boolean): HTMLElement {
  const a = el("span", "stackfold", open ? "▾" : "▸");
  a.title = open ? `fold ${baseName(g.key)}'s lanes away` : `unfold ${g.lanes.length} lane(s)`;
  a.onclick = (e) => { e.stopPropagation(); setStackOpen(g, !open); };
  return a;
}

// The anchor's own chips: how many lanes, what they need while hidden, and one way to start another.
function stackChips(g: Stack, open: boolean): HTMLElement[] {
  const out: HTMLElement[] = [];
  const n = el("span", "stackn", `⎇${g.lanes.length}`);
  n.title = `${g.lanes.length} lane${g.lanes.length === 1 ? "" : "s"} in ${baseName(g.key)}`;
  out.push(n);
  if (!open) {
    // Aggregation, not decoration: these two are the "somebody has to look at this" signals, and
    // folding must not be able to hide them. Clicking takes you to the lane that owns the signal —
    // which means unfolding first, so what you land on is visible in the list you came from.
    const pending = g.lanes.filter((l) => l.mergePending);
    if (pending.length) {
      const rb = el("span", "revb", pending.length > 1 ? `⏸${pending.length}` : "⏸");
      rb.title = `${pending.length} folded lane(s) with agent conflict resolutions nobody has reviewed`;
      rb.onclick = (e) => {
        e.stopPropagation();
        setStackOpen(g, true);
        showSlot(pending[0].id);
        setBoard(true);
      };
      out.push(rb);
    }
    const comments = g.lanes.reduce((a, l) => a + (l.share?.comments ?? 0), 0);
    if (comments > 0) {
      const cb = el("span", "cmtb", `💬${comments}`);
      cb.title = `${comments} guest message(s) in folded lanes`;
      out.push(cb);
    }
  }
  return out;
}

// One occupied slot. `stack` is set only when this row is the anchor of a fold — it carries the
// arrow, the ⎇N chip, the quick-lane chip and, while folded, the badges of the lanes it hides.
// B3 · the inbound chip's PAINTED text, in one place because two readers need exactly it: the row
// that draws the chip and the sidebar's render key, which must be keyed on what is painted and not
// on the raw byte count (the rule `behind` and the ctx chip above both document).
const inboundChipLabel = (inb: { sends: number; bytes: number }): string =>
  `in ${inb.bytes < 1024 ? `${inb.bytes} B` : `${Math.round(inb.bytes / 1024)} KB`}`;
function slotRow(s: ActiveSlot, stack: Stack | undefined, refs: ReadonlyMap<number, string>): HTMLElement {
  const open = stack ? stackOpen.has(stack.foldKey) : false;
  const visible = panes.some((p) => p.slot === s.id);
  const isFocused = panes[focused]?.slot === s.id;
  const row = el("div", "slot" + (isFocused ? " current" : visible ? " shown" : "") + (s.worktree ? " lane" : ""));
  row.dataset.slot = String(s.id);
  tintProject(row, projectOf(s));
  if (stack) row.appendChild(foldArrow(stack, open));
  {
      const displayLabel = s.label ?? baseName(s.cwd);
      const lbl = el("span", "lbl", displayLabel);
      if (s.worktree) {
        const title = `${s.worktree.branch}\nslot ${s.id} · ${displayLabel}\n${s.cwd}`;
        const identity = el("span", "laneidentity");
        const ref = el("span", "laneref", refs.get(s.id) ?? s.worktree.branch);
        ref.title = title;
        identity.title = title;
        identity.append(ref, el("span", "lanesep", "·"), lbl);
        row.appendChild(identity);
        lbl.title = title;
      } else {
        row.append(el("span", "n", String(s.id)), lbl);
        lbl.title = s.cwd;
      }
      lbl.ondblclick = (e) => {
        e.stopPropagation();
        startRename(row, s);
      };
      if (autosList.some((a) => a.slot === s.id && a.enabled)) {
        const b = el("span", "autobadge", "⏱");
        b.title = "has scheduled prompts";
        row.appendChild(b);
      }
      if (stack) for (const c of stackChips(stack, open)) row.appendChild(c);
      // ⎇+ used to sit on all twelve empty rows at once, saying nothing about which repo it meant.
      // Here it names its own repo by sitting on it. Not on lanes: a lane off a lane would nest
      // .worktrees inside a worktree, which is the same rule the old `quickRepo` followed.
      if (s.git && !s.worktree) {
        const parent = normalizeLaneAnchor({ slot: s.id, openedAt: s.openedAt });
        row.appendChild(quickLaneChip(s.repo ?? s.cwd, parent ?? undefined));
      }
      // row = identity + state: a lane's lifecycle color IS its land-readiness, shown as
      // ONE dot. The branch name and counts that used to fill a 96px badge move into the
      // tooltip — the name up top is already derived from this same branch (baseName(cwd))
      if (s.worktree && s.git?.branch) {
        // lifecycle: editing (uncommitted) → ready (clean but commits to push/land) → clean
        const state = s.git.dirty > 0 ? "editing" : s.git.ahead > 0 ? "ready" : "clean";
        const dot = el("span", `lcdot ${state}`);
        dot.title = `${s.git.branch} — ${s.git.dirty} uncommitted, ${s.git.ahead} to land, ${s.git.behind} behind`
          + `\nFleet lane (${state}). ± review · open the board to land`;
        row.appendChild(dot);
      }
      // a lane's whole point is review-then-land, so its ± sits inline (not hover-hidden) —
      // the one action that belongs on the row; everything else (share/export/rename/land)
      // lives in the board now
      if (s.worktree) {
        const dff = el("span", "lanediff", "±");
        dff.title = "review this lane's diff";
        dff.onclick = (e) => { e.stopPropagation(); void openDiff(s.id); };
        row.appendChild(dff);
      }
      if (s.share && s.share.comments > 0) {
        // passive signal — hidden while the hover-action row is up; the 💬 in that row
        // (below) is the clickable path, so aiming at the badge still lands right
        const cb = el("span", "cmtb", `💬${s.share.comments}`);
        cb.title = `guest chat — ${s.share.comments} message${s.share.comments === 1 ? "" : "s"}`;
        row.appendChild(cb);
      }
      if (s.mergePending) {
        // a resolved conflict waiting for review — discoverable without opening the board
        const rb = el("span", "revb", "⏸");
        rb.title = "agent conflict resolutions nobody has reviewed — review & land (open the board)";
        rb.onclick = (e) => { e.stopPropagation(); showSlot(s.id); setBoard(true); };
        row.appendChild(rb);
      }
      if (s.codexRecovery) {
        const cr = s.codexRecovery;
        const needsOwner = cr.state === "ambiguous" || cr.state === "lost";
        const chip = el("span", `ctxfill cxaction${needsOwner ? " unknown" : ""}`,
          `cx ${cr.state}${cr.disconnectSeenAt ? " !" : ""}`);
        chip.title = `Codex recovery: ${cr.state}`
          + (cr.sessionId ? `\nsession ${cr.sessionId}` : "\nno conversation id bound")
          + (cr.disconnectSeenAt
            ? `\nstream disconnect seen ${new Date(cr.disconnectSeenAt).toLocaleString()} — advisory; the live TUI owns retry`
            : "")
          + (needsOwner ? "\nowner attention required; Fleet will not guess" : "")
          + "\nclick to inspect eligible identities and bind one exact UUID";
        chip.onclick = (e) => { e.stopPropagation(); openCodexDlg(s.id); };
        row.appendChild(chip);
      }
      // context fill — a SENSOR and nothing else: no threshold, no colour state, no action. The
      // unknown case is drawn as "ctx ?", never as 0% and never as an empty bar: a blank meter reads
      // as "fresh session", which is the one wrong answer this fact must not be able to give.
      // Rounded to whole percent because the render key below is keyed on what is painted — a live
      // decimal would rebuild the sidebar every poll and kill hover state.
      {
        const c = s.ctx ?? null;
        // "ctx" spelled out: a bare "?" next to the row's other glyphs would be unreadable, and "ctx NN%"
        // is the vocabulary the owner's own terminal status line already uses for this number.
        const cx = el("span", "ctxfill" + (c ? "" : " unknown"), c ? `ctx ${Math.round(c.pct)}%` : "ctx ?");
        cx.title = c
          ? `context fill — ${c.usedTokens.toLocaleString()} of ${c.windowTokens.toLocaleString()} input tokens (${c.pct}%)`
          : "context fill unknown — this slot has no pinned claude transcript with a usage record yet"
            + " (or runs a harness/model Fleet cannot measure). Not an empty context.";
        row.appendChild(cx);
      }
      // B3 · the cost of talking to this session today. A SENSOR beside the context fill and read
      // the same way: no threshold, no colour, no action. It is only drawn when the server sent the
      // key, because the key's absence IS the answer ("nothing typed into this pane today") — and
      // an unconditional "in 0" would read as a claim about a session Fleet may never have written
      // to at all.
      if (s.inbound) {
        const { sends, bytes } = s.inbound;
        const inb = el("span", "ctxfill", inboundChipLabel(s.inbound));
        inb.title = `Fleet typed ${bytes.toLocaleString()} bytes into this pane today,`
          + ` in ${sends} send${sends === 1 ? "" : "s"} (local day).`
          + "\nDelivered bytes only — a refused send costs the session nothing."
          + "\nCounted per slot number, so a slot recycled today carries both occupants' sends.";
        row.appendChild(inb);
      }
      // green = live in a pane, or a background session that just produced output. A FOLDED anchor
      // also lights up for its hidden lanes: a lane that just produced output is exactly the kind of
      // thing you must not have to unfold to notice (§F3 edge 2).
      const hidHot = !!stack && !open && stack.lanes.some(
        (l) => serverNow - l.lastOutput < RECENT_MS || panes.some((p) => p.slot === l.id));
      const live = el("span", "act" + (visible || serverNow - s.lastOutput < RECENT_MS || hidHot ? " hot" : ""));
      if (hidHot && !visible && serverNow - s.lastOutput >= RECENT_MS) live.title = "a folded lane is active";
      row.appendChild(live);
      const act = el("div", "slotact");
      if (s.git && !s.worktree) {
        // plain repo session: diff is available but secondary, so it stays in the hover row
        const dff = el("span", "diff", "±");
        dff.title = "review working diff";
        dff.onclick = (e) => { e.stopPropagation(); void openDiff(s.id); };
        act.appendChild(dff);
      }
      // rename/merge/land used to live here as hover-only glyphs — moved to the board's
      // labeled "actions" section (renb/lb) so they're touch-reachable and self-explanatory;
      // the row keeps only ± (added above) and ✕ kill (below) plus this chat badge.
      if (s.share) {
        const ca = el("span", "cmtact" + (s.share.comments > 0 ? " hot" : ""), "💬");
        ca.title = "guest chat";
        ca.onclick = (e) => { e.stopPropagation(); openShareDlg(s.id); };
        act.appendChild(ca);
      }
      const kill = el("span", "kill", "✕");
      kill.title = "kill session";
      kill.onclick = async (e) => {
        e.stopPropagation();
        if (s.worktree) {
          // a lane-holding slot never had real git-state context on kill before — fetch it,
          // same risk preview the board's land action uses (kill leaves the worktree on disk;
          // land/remove it from the board)
          const risk = await fetchSlotRisk(s.id);
          const ok = await showRiskPreview(
            `Kill session ${s.id} (${baseName(s.cwd!)})? The worktree is left on disk (open the board to land or remove it).`, risk, "kill");
          if (!ok) return;
        } else if (!confirm(`Kill session ${s.id} (${baseName(s.cwd!)})? The claude session and its history are gone.`)) {
          return;
        }
        await post(`/api/slots/${s.id}/kill`, {});
        for (const p of panes) if (p.slot === s.id) p.assign(0);
        await refresh();
      };
      act.appendChild(kill);
      row.appendChild(act);
      // mobile-only action strip: share/export/rename/land moved off the row into the
      // desktop-only board, leaving phones with no reachable share/export/rename/land.
      // These are CSS-hidden on desktop (.rowacts { display:none }) so the row stays clean.
      const rowacts = el("div", "rowacts");
      const mkact = (glyph: string, title: string, fn: () => void) => {
        const b = el("span", "rowact", glyph);
        b.title = title;
        b.onclick = (e) => { e.stopPropagation(); fn(); };
        rowacts.appendChild(b);
      };
      mkact("⤴", "share", () => openShareDlg(s.id));
      mkact("⇩", "export", () => window.open(`/api/slots/${s.id}/export`, "_blank"));
      mkact("✎", "rename", () => startRename(row, s));
      // ✔ save = quick-commit this lane's uncommitted work — lets a phone user save outside
      // the conversation (land/merge refuse a dirty tree; a kill would otherwise lose it)
      if (s.worktree) mkact("✔", "save (commit work)", () => { void doCommit(s.id, "quick"); });
      if (s.worktree && landsEnabled) mkact("⏏", "land", () => { void doLand(s.id); });
      if (s.worktree) mkact("⇲", "shelve (set aside + note)", () => { void doShelve(s.id); });
      row.appendChild(rowacts);
      // §F3 click semantics, in the owner's words ("erst aufklappt und klickbar wenn man auf ihn
      // drückt, bleibt dann auf"): clicking a FOLDED stack only unfolds it — it does not steal the
      // pane. Once open the anchor is an ordinary row again and focuses its session. Folding back is
      // the arrow's job alone, or focusing the main session would always cost you the open fold.
      row.onclick = stack && !open ? () => setStackOpen(stack, true) : () => showSlot(s.id);
  }
  return row;
}

function renderChips(chips: string[]) {
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
// predict that the reader would be the owner. Deliberately NOT the .plaudit bar — that channel is
// the post-land audit ALARM, and "there is a newer build" is not an alarm.
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

// --- verification tier 2 on the board: the post-land audit alarm --------------------------------
// The server runs the full suite AFTER every land that moves main and gates NOTHING on the outcome
// (server.ts, runPostLandAudit). Rendering it is therefore the entire safety net — an audit nobody
// reads is an audit that never ran. The result rode the 2s poll payload for a client that had no
// reader at all, and two RED audits on 2026-07-26 went unread as the direct consequence.
let postLandAudit: PostLandAuditInfo | null = null;
function renderPostLandAudit() {
  const bar = $("plaudit");
  const al = postLandAlarm(postLandAudit, Number(localStorage.getItem(PLA_ACK_KEY) ?? 0));
  if (!al) {
    bar.replaceChildren();
    bar.style.display = "none";
    return;
  }
  const body = el("div", "plabody");
  body.appendChild(el("div", "plahd", al.headline));
  body.appendChild(el("div", "plawhere", al.where));
  body.appendChild(el("div", "planote", `${fmtTs(postLandAudit?.at ?? 0)} · ${al.note}`));
  // THE WHOLE LOG, when a remote helper handed one over. `out` on the row is a 4 KB tail, and for a
  // RED audit the next question is always "which checks, and what was around them" — an answer that
  // used to live only in a run directory the helper deletes in its own `finally`. Drawn only when
  // the rail actually joined something in: no link is "no log arrived", never an empty page.
  const art = postLandAudit?.artifact;
  if (art) {
    const line = el("div", "planote");
    const a = el("a", "plalog", `suite.log · ${Math.max(1, Math.round(art.bytes / 1024))} KB`) as HTMLAnchorElement;
    a.href = art.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.title = `The full suite log the helper uploaded after this verdict, ${art.bytes} bytes,`
      + ` sha256 ${art.sha256.slice(0, 12)}…. It arrived AFTER the row was written and is joined in`
      + ` from a side rail — nothing about it changed the result above.`;
    line.appendChild(a);
    body.appendChild(line);
  }
  const ack = el("button", "plaack", "acknowledge") as HTMLButtonElement;
  ack.title = "hide this alarm. The dismissal is keyed to THIS audit — the next non-green one raises it again.";
  ack.onclick = () => {
    localStorage.setItem(PLA_ACK_KEY, String(postLandAudit?.at ?? 0));
    renderPostLandAudit();
  };
  bar.className = `plaudit ${al.tone}`;
  bar.replaceChildren(body, ack);
  bar.style.display = "flex";
}

let chipCmds: string[] = [];
let lastRender = "";
async function refresh() {
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
      gate?: GateInfo | null; errors?: ErrorsInfo | null;
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
      deployGap?: DeployGapInfo | null; bundleStale?: BundleStaleInfo | null };
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
    programsPoll = data.programs ?? [];
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
    // tier 2's only reader. Rendered on every poll rather than behind the render-key diff below:
    // that key is about the slot tiles, and an alarm must not wait on an unrelated change to appear.
    postLandAudit = data.postLandAudit ?? null;
    renderPostLandAudit();
    // read here, painted by the board's own timer — the gate line lives inside a panel that is
    // closed most of the time, so there is nothing to repaint from this hot path
    gateInfo = data.gate ?? null;
    // same rail, same timer: the running audit is drawn inside the gate section, which the board's
    // own repaint owns. The elapsed clock does not wait on this poll — it ticks off the client.
    postLandLive = data.postLandAuditLive ?? null;
    errorsInfo = data.errors ?? null;
    // same rail as the gate line: read on the 2 s poll, painted by the board's own timer, because
    // the panel lives inside a board that is closed most of the time. The 💻 button and an OPEN
    // device dialog are painted from here instead — they have no timer of their own, and a badge
    // that only moved when the board happened to repaint would be a stale count.
    helperDevicesInfo = data.helperDevices ?? [];
    // the window travels WITH the rows (server.ts, the /api/sessions projection). Absent rows means
    // absent window, and the reset to null is the honest state — not the last window we happened to see.
    deviceOnlineMs = data.helperOnlineMs ?? null;
    renderDevBtn();
    if (devIsOpen()) renderDevDlg();
    // the attention inbox's whole share of the 2s poll: one number. It paints the badge, and while
    // the panel is open a CHANGE in it is what re-fetches the rows — the panel never polls itself.
    setAttentionOpen(data.attentionOpen ?? 0);
    programsStale = typeof data.programsStale === "number"
      && Number.isInteger(data.programsStale) && data.programsStale > 0 ? data.programsStale : 0;
    setReportsAwaitingOwner(data.reportsAwaitingOwner ?? 0);
    // the operations inbox reads the events the poll already carries — no extra request, and the
    // 📥 badge counts only rows that were minted FOR it (delivery inbox, still awaiting the owner)
    setOpsEvents(data.events ?? []);
    deployGapInfo = data.deployGap ?? null;
    bundleStaleInfo = data.bundleStale ?? null;
    serverNow = data.now;
    serverClockSkew = data.now - Date.now();
    shareBase = data.shareBase ?? "";
    chipCmds = data.chips;
    renderChips(data.chips);
    // hot also for a PROPOSED done-criterion (2026-08-05): a clarify lane that filed its
    // proposal sits parked on the owner — before this, nothing on the board said so and the
    // lane waited invisibly until the owner happened to reselect the task
    // one source for "is there something on me": the SAME grouping the overlay draws, so the
    // badge and the list can never disagree about what needs the owner. (It used to be its own
    // hand-rolled predicate over source+criterion, which is how the two drifted.)
    $("queuebtn").classList.toggle("hot", tasksList.some((t) => qGroupOf(t) === "needs"));
    // skip the DOM rebuild when nothing visible changed — a full re-render kills hover state
    const key = JSON.stringify([focused, panes.map((p) => p.slot),
      autosList.filter((a) => a.enabled).map((a) => a.slot),
      data.slots.map((s) => [s.cwd, s.label, s.share?.id, s.share?.comments, s.mergePending, serverNow - s.lastOutput < RECENT_MS,
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
        s.inbound ? inboundChipLabel(s.inbound) : null])]);
    if (key !== lastRender) {
      lastRender = key;
      renderSlots();
    }
    renderQueue(); // no-op unless the queue overlay is open; keeps it live
    // keep an open task DETAIL honest the same way (2026-08-05): a clarify lane's criterion
    // proposal arrived on this poll, but the detail only ever repainted on reselect — the
    // owner sat in front of a stale pane while the lane waited on them. Keyed on the fields
    // the detail actually paints, so hover and an in-progress criterion edit survive quiet polls.
    if (qShell?.isOpen() && qPick !== null && qPick.startsWith("prog:")) {
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
      if (dk !== qDetailKey) { qDetailKey = dk; renderQueueDetail(); }
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
      if (dk !== qDetailKey) { qDetailKey = dk; renderQueueDetail(); }
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
  localStorage.setItem("fleet.datasaver", on ? "1" : "0");
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
function renderDiffInto(target: HTMLElement, diff: string) {
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
async function openReview(slotId: number, initial: RvSource, startAt?: RvPick) {
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
      if (!cwd) { shell.detail.appendChild(el("div", "shellhint", "this slot has no working directory")); return; }
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
    if (!d) { shell.detail.appendChild(el("div", "shellhint", "loading…")); return; }
    const hash = pickCommit(pick);
    if (hash) {
      const c = commits?.commits.find((x) => x.hash === hash);
      const cd = commitDiffs.get(hash);
      shell.detail.appendChild(el("div", "rvhead", c?.subject ?? "commit"));
      shell.detail.appendChild(el("div", "diffstat",
        c ? `${c.hash} · ${fmtTs(c.ts)}${c.stat ? ` · ${c.stat}` : ""}` : hash));
      if (!cd) { shell.detail.appendChild(el("div", "shellhint", "loading…")); return; }
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
        if (!f) { shell.detail.appendChild(el("div", "shellhint", "that file is not in this commit")); return; }
        shell.detail.appendChild(el("div", "rvsub", `${f.path} · +${f.add} −${f.del}`));
        rvWholeFile(f.newPath, f.text, hash);
        showDiffText(shell.detail, f.text);
        return;
      }
      if (!cd.diff) {
        shell.detail.appendChild(el("div", "shellhint",
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
      if (!f) { shell.detail.appendChild(el("div", "shellhint", "that file is no longer in this diff")); return; }
      shell.detail.appendChild(el("div", "rvhead", f.path));
      shell.detail.appendChild(el("div", "diffstat", `+${f.add} −${f.del}`));
      rvWholeFile(f.newPath, f.text, null);
      showDiffText(shell.detail, f.text);
      return;
    }
    if (d.empty) { shell.detail.appendChild(el("div", "shellhint", d.empty)); return; }
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
      if (commits.capped) shell.list.appendChild(el("div", "shellhint", "…older commits not listed"));
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
async function openDiff(slotId: number) { await openReview(slotId, "working"); }
async function openMergeDiff(slotId: number) { await openReview(slotId, "land"); }

// --- task queue window ---
//
// The queue was a flat list in a 900px box: every task rendered its whole text into a cramped row,
// there was no search, and `created` was fetched on every open and never shown.
//
// It also had a defect that only shows up if you type slowly. refresh() calls renderQueue() on
// every 2s poll to keep the list live, and renderQueue() rebuilt the panel with replaceChildren —
// including the "new task" textarea. Typing a task for longer than two seconds LOST IT, in a file
// whose next comment down explains that rebuilds kill hover state and button focus. So the window
// is poll-safe by construction: the compose box is created once per open and the poll never touches
// it, the list is rebuilt only when the task data actually changed (key comparison, like
// renderSlots), and the detail pane is rebuilt only when the SELECTION changes.
const taskText = new Map<string, string>();
// the compiled brief — the exact bytes a lane will receive. Never on the poll (it is a whole
// prompt); the detail pane shows and edits it from here.
// `by` says WHO pinned an edited brief; ABSENT means it was pinned before authorship was recorded,
// and every site below reads that absence exactly as it read `edited` alone — which is what keeps
// every stored brief rendering byte-for-byte as it did (server/types.ts, BriefAuthor).
interface FullBrief { text: string; at: number; model: string; edited: boolean; by?: "owner" | "main" }
// ONE reading of that pair for every surface, so the board and the Akte cannot drift into two
// answers about the same brief. Only an explicit "main" stamp says a machine authored it.
const briefByMain = (b: { edited: boolean; by?: string } | undefined): boolean =>
  !!b && b.edited && b.by === "main";
const taskBriefFull = new Map<string, FullBrief>();
// same reason for the criterion: the poll knows THAT one exists, this knows what it says
const taskCriterionFull = new Map<string, NonNullable<TaskInfo["criterion"]>>();
// …and for the refine proposal: the poll knows a proposal landed, this knows what it proposes
const taskRefineFull = new Map<string, TaskRefineFull>();
// …and the comment thread. Same split for the same reason: a comment is free text of unbounded
// length, and the 2 s poll is the one place in this client where bytes are a standing cost.
// `from`/`verdict` are the LANE half of the thread (N2). Their absence is the owner's own remark,
// so the two populations are told apart by presence, never by a flag that could be forged.
interface TaskCommentView { id: string; ts: number; text: string; from?: string;
  verdict?: "erledigt" | "widerlegt" | "offen" }
const taskCommentsFull = new Map<string, TaskCommentView[]>();
// N3 · the two full lists. `taskNotesFull` is keyed by the AUFTRAG (which sources it names),
// `taskVerdictsFull` by the NOTIZ (which task-scoped reports stand on it) — the same two ends of
// the assignment the server keeps apart, kept apart here for the same reason.
interface TaskNotePinView { noteId: string; at: number; by: "owner" | "main" }
interface TaskNoteVerdictView { taskId: string; branch: string; verdict: string; text: string;
  at: number; landedAt?: number; landedSha?: string }
const taskNotesFull = new Map<string, TaskNotePinView[]>();
const taskVerdictsFull = new Map<string, TaskNoteVerdictView[]>();
let taskTextKey = ""; // the id+full-data-generation set this cache was last filled for
let taskTextBusy = false;
// The poll's briefAt invalidates every browser. This local epoch still prevents a brief save in
// THIS browser from being overtaken by an older GET /api/tasks before the next poll arrives.
let taskTextEpoch = 0;
let qShell: Shell | null = null;
let qPick: string | null = null;  // selected task id; null = the compose row
let qQuery = "";
type QView = "work" | "programs" | "history" | "waves";
let qView: QView = "work";        // the operational list is primary; polls never reset the view
let qProgDone = false;            // show `complete` programs in the Programs section (default off)
let qKey = "";                    // the data key the list was last built from
let qDetailKey = "";              // the data key the DETAIL pane was last built from (see refresh)
let qCompose: HTMLTextAreaElement | null = null; // created ONCE per open — never re-created by a poll
let qRepoIn: HTMLInputElement | null = null; // target-repo input, same once-per-open lifecycle
// the comment box, kept across rebuilds for the SELECTED task — same lifecycle trick as qCompose
// and for the same reason: a poll that repaints the detail must never eat half a typed sentence.
// Keyed by task id, because carrying one task's draft over to another row would be worse.
let qCmBox: HTMLTextAreaElement | null = null;
let qCmFor: string | null = null;
// Brief and criterion edits need the same poll-safe lifetime as comments. The server may deliver a
// newly compiled value while the untouched box is open, so each draft remembers both its seed and
// whether the owner has typed: fresh server text replaces an untouched seed, never local work.
interface QTextDraft { for: string; box: HTMLTextAreaElement; seed: string; dirty: boolean }
let qBriefDraft: QTextDraft | null = null;
let qCriterionDraft: QTextDraft | null = null;
// the task whose RAW start the owner has ticked off (see the guard in renderQueueDetail). Kept
// across repaints — the 2 s poll rebuilds this pane — and keyed by ID, so an acknowledgment can
// never carry over to the row you look at next. Dropped when the window closes: it is a decision
// made in one sitting, not a setting.
let qRawAck: string | null = null;

// --- TASK SPAWN CHOICE: the executable contract of the ▸ start / ▸ clarify acts. e2e/tasks.ts
// cuts this block out of the real source (between this marker and the closing one), transpiles it
// and runs it against fixtures — so the exact request bodies and the pre-start block are PROVEN,
// not read off a screenshot. Keep it free of DOM and of every other symbol in this file. ---
type QSpawnPick = { harness: string; model: string; effort: string }; // "" = not chosen here
type QSpawnRow = { harness: string | null; model: string | null; effort: string | null } | undefined;
type QSpawnHarness = { id: string; default: boolean; role?: "agent" | "place";
  supports: { model: boolean; effort: boolean }; effortLevels: string[] };
type QSpawnOrigin = "picked" | "row" | "default";
type QSpawnField = { value: string | null; origin: QSpawnOrigin };
type QSpawnEffective = { harness: QSpawnField; model: QSpawnField; effort: QSpawnField };
const Q_SPAWN_EMPTY: QSpawnPick = { harness: "", model: "", effort: "" };
// Mirrors the server's per-field precedence at POST /api/tasks/:id/dispatch: an explicit body
// field wins, an absent one falls to the ROW's own persisted choice (Task.spawn), absence on both
// sides is the default adapter. `value: null` with origin "default" is that absence — the server's
// DEFAULT_SPAWN — and never a claim about which concrete model or level the adapter then runs.
function qEffectiveSpawn(pick: QSpawnPick, row: QSpawnRow): QSpawnEffective {
  const field = (picked: string, stored: string | null | undefined): QSpawnField =>
    picked ? { value: picked, origin: "picked" }
      : stored ? { value: stored, origin: "row" } : { value: null, origin: "default" };
  return { harness: field(pick.harness, row?.harness), model: field(pick.model, row?.model),
    effort: field(pick.effort, row?.effort) };
}
// What would stop the start BEFORE the request: the refusals the route answers with 400, judged
// against the EFFECTIVE harness, in the route's order and in the route's own words (e2e/tasks.ts
// holds the two texts equal against the live server). null = nothing blocks. An empty catalogue
// cannot judge and blocks nothing — the server validates regardless; this only makes a refusal
// it would give visible on the row, before the click. The model's charset is NOT judged here
// (the catalogue does not publish it), so a bad model stays the server's 400.
function qSpawnProblem(eff: QSpawnEffective, catalogue: QSpawnHarness[]): string | null {
  if (!catalogue.length) return null;
  const h = eff.harness.value === null ? catalogue.find((x) => x.default)
    : catalogue.find((x) => x.id === eff.harness.value);
  if (!h) return `unknown harness (one of: ${catalogue.map((x) => x.id).join(", ")})`;
  if (eff.model.value !== null && !h.supports.model) return `harness ${h.id} takes no model`;
  if (eff.effort.value !== null) {
    if (!h.supports.effort) return `harness ${h.id} takes no effort`;
    if (!h.effortLevels.includes(eff.effort.value)) return `bad effort (one of: ${h.effortLevels.join(", ")})`;
  }
  return null;
}
// The request body of each act — and nothing else. ▸ start carries exactly the PICKED fields of
// the triple (an unpicked one is absent, so the server's own fallback to the row and then to the
// default stays the semantics) plus the raw acknowledgment when the row is raw. ▸ clarify first
// carries the same picked triple under `clarify: true` — it opens a lane too, on the chosen
// harness — and never the acknowledgment: a clarify lane commits nothing, so nothing raw is
// vouched for. Neither act carries a status: the row's status is the server's to move.
function qDispatchBody(act: "start" | "clarify", pick: QSpawnPick, rawAck: boolean): Record<string, unknown> {
  const triple = {
    ...(pick.harness ? { harness: pick.harness } : {}),
    ...(pick.model ? { model: pick.model } : {}),
    ...(pick.effort ? { effort: pick.effort } : {}),
  };
  return act === "clarify" ? { clarify: true, ...triple } : { ...triple, ...(rawAck ? { acknowledged: true } : {}) };
}
// --- end TASK SPAWN CHOICE ---

// --- TASK DETAIL HEAD: what a task row says about itself and what it offers NEXT, as a pure
// plan. The head is the first thing in the detail pane, above every section, because the pane's
// job is a decision and the decision was below the fold: measured 2026-09-01, the Actions of a
// running row sat under the full request text and were unreachable without scrolling
// (docs/messungen/2026-09-01-task-workbench-visual-baseline.md).
//
// EXACTLY ONE main action lives here. Everything else — the other acts, the Kind selector, the
// spawn pickers — stays in Actions below, and ✕ delete lives in its own Danger zone, never beside
// the one action. e2e/tasks.ts cuts this block out of the real source, transpiles it and runs it,
// so the station and the one action per status are proven rather than read off a screenshot.
// Keep it free of DOM and of every other symbol in this file. ---
// The rail an ordinary auftrag walks, in order. `done` is its landed/done end.
type QLifeStation = "pending" | "queued" | "sent" | "done";
const Q_LIFE_STATIONS: readonly QLifeStation[] = ["pending", "queued", "sent", "done"];
// Where the row stands. Two ends are NOT stations on that rail and are said as themselves:
// `archived` (taken out of the rail) and `advisory` (a row that never assigns work at all). A
// status this build has never heard of is `unknown` — the poll is a foreign surface, and an
// unreadable status is not a pending row.
type QLifeMark = QLifeStation | "archived" | "advisory" | "unknown";
// `reached` = how many stations of the rail are behind or at the current one, so the bar marks the
// past without a second rule. It is 0 for every mark that is not ON the rail — including
// `archived`, whose earlier walk the poll does not carry: absence of the history is not a claim
// that it never happened, so nothing is marked.
interface QLifecycle { stations: readonly QLifeStation[]; current: QLifeMark; reached: number }
// The one act offered in the head. `none` is a state, not a missing field: a closed row and a
// `sent` row with no attachable lane both have nothing to offer, and each says why in its own
// words rather than showing an empty slot.
// `clarify` is a PLACEMENT key only since 2026-09-10: no head path produces it any more (see
// qMainActionOf). It stays in the union because place()/isMain()/mainCls() address the ▸ clarify
// first button by it, and an act nothing selects simply renders that button in the Actions row.
type QMainAct = "adopt" | "clarify" | "release" | "start" | "open-lane" | "none";
interface QMainSlot { act: QMainAct; label: string | null; why: string; slot: number | null }
// `hasCriterion` stood here until 2026-09-10: the head consulted it to decide between ▸ clarify
// first and release ▸, and only in combination with the retired analyst's `criterion` blocker.
// With the blocker gone the criterion's presence decides nothing in the head, so the field is not
// carried — a fact the head reads but never acts on is the shape this cut is removing.
interface QHeadRow { status: string; kind?: string; slot?: number; repo?: string; programId?: string }
// the lane join, reduced to what the head needs: `lane` carries the slot its ▸ open lane names.
interface QHeadLane { kind: "lane" | "refused" | "none"; slot?: number }
interface QHeadPlan { status: string; program: string; repo: string; life: QLifecycle; main: QMainSlot }

// ADVISORY is every kind the dispatcher refuses, phrased as the negative — the same rule as
// qAdvisory below, restated here because this block must stay standalone; e2e/tasks.ts holds the
// two equal over the whole kind set, so a fifth kind cannot mean two different things.
const qHeadAdvisory = (kind: string | undefined): boolean => kind !== undefined && kind !== "auftrag";
const qShortRepo = (repo: string | undefined): string => {
  if (!repo) return "repo unknown";
  const parts = repo.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || "/";
};
// A bound program that the Program read cannot resolve is UNKNOWN, never "no program": the read
// fails, a row is discarded, an id outlives its program — and every one of those would otherwise
// render as the row belonging to nothing.
const qHeadProgram = (programId: string | undefined, title: string | null): string =>
  !programId ? "no program" : title ?? "program unknown";
function qLifecycleOf(status: string, kind: string | undefined): QLifecycle {
  const idx = Q_LIFE_STATIONS.indexOf(status as QLifeStation);
  // archived first: an archived advisory row is out of the rail either way, and "archived" is the
  // fact the owner acts on (restore), while advisory is what it was.
  const current: QLifeMark = status === "archived" ? "archived"
    : qHeadAdvisory(kind) ? "advisory"
      : idx >= 0 ? Q_LIFE_STATIONS[idx] : "unknown";
  return { stations: Q_LIFE_STATIONS, current, reached: idx >= 0 && current === Q_LIFE_STATIONS[idx] ? idx + 1 : 0 };
}
// THE ONE NEXT ACTION, by status. Each `act` names an act that already exists in the Actions
// section and is wired to that same handler — this reorders the surface, it does not add a door.
// `open-lane` is the exception and is not an API call at all: it focuses the pane the row is
// already running in.
function qMainActionOf(row: QHeadRow, lane: QHeadLane): QMainSlot {
  const none = (why: string): QMainSlot => ({ act: "none", label: null, why, slot: null });
  if (row.status === "done") return none("this row is closed — nothing here is waiting on you");
  if (row.status === "archived") return none("archived — restore it in Actions below to work on it again");
  if (qHeadAdvisory(row.kind)) {
    // the one narrow door out of advisory: the compatibility alias for a pending notiz. Every
    // other advisory row changes its Kind in Actions first; adopting is never a START.
    return row.status === "pending" && row.kind === "notiz"
      ? { act: "adopt", label: "→ adopt as a task", slot: null,
        why: "an observation assigns no work — adopting turns it into a brief, which you then release" }
      : none("an advisory row assigns no work — change its Kind in Actions below to enter the workflow");
  }
  // A PENDING ROW'S ONE NEXT ACTION IS THE RELEASE. ▸ clarify first was the head's answer here
  // while the retired queue analyst could flag a row as having no derivable done-criterion — a
  // SIGNAL about this row. With the reader gone the only fact left is "no criterion is stored",
  // which is true of nearly every draft: promoting it to the one next action would make the head
  // recommend a clarify lane for the whole queue. So clarify keeps its place in the Actions row,
  // where it is offered unconditionally for a startable row, and the head says what it always did.
  if (row.status === "pending")
    return { act: "release", label: "release ▸", slot: null,
      why: "hands it to the dispatcher, which runs released tasks in order" };
  if (row.status === "queued")
    return { act: "start", label: "▸ start by hand", slot: null,
      why: "released — the dispatcher takes released tasks in order; this starts it now, whether it is on or off" };
  if (row.status === "sent") {
    // a `sent` row whose pointer attaches nothing gets NO button: the alternative offers a slot
    // that is empty, recycled or foreign. The refusal itself is spelled out under Evidence.
    return lane.kind === "lane" && typeof lane.slot === "number"
      ? { act: "open-lane", label: `▸ open lane — slot ${lane.slot}`, slot: lane.slot,
        why: "this row is running in that pane — opening it closes the queue window" }
      : none("no lane is attached to this row — Evidence below says why");
  }
  return none(`status ${row.status} is not one this build knows — nothing is offered on it`);
}
function qHeadPlan(row: QHeadRow, programTitle: string | null, lane: QHeadLane): QHeadPlan {
  return {
    status: `${row.status}${typeof row.slot === "number" ? ` · slot ${row.slot}` : ""}`,
    program: qHeadProgram(row.programId, programTitle),
    repo: qShortRepo(row.repo),
    life: qLifecycleOf(row.status, row.kind),
    main: qMainActionOf(row, lane),
  };
}
// --- end TASK DETAIL HEAD ---

// the owner's spawn pick per task row — harness/model/effort chosen for THIS row's start. Keyed by
// task id and kept across the 2 s repaint like qRawAck: a pick begun on one row never rides into
// the next, and a poll never resets it. Dropped when the window closes or the row starts.
const qSpawnPick = new Map<string, QSpawnPick>();
// the row's own persisted choice (Task.spawn), from GET /api/tasks like every other full field —
// the poll's digest does not carry it. Absent = the row never stored one (DEFAULT_SPAWN).
const taskSpawnFull = new Map<string, NonNullable<QSpawnRow>>();
// one kept node per task id, so a poll repaint re-syncs the pickers IN PLACE: an open dropdown or
// a half-typed model keeps its focus and caret (restoreFocus needs the focused node to survive).
let qSpawnUi: { for: string; box: HTMLElement; sync: () => void } | null = null;
const qSpawnStateOf = (id: string) => {
  const pick = qSpawnPick.get(id) ?? Q_SPAWN_EMPTY;
  const row = taskSpawnFull.get(id);
  const eff = qEffectiveSpawn(pick, row);
  return { pick, row, eff, problem: qSpawnProblem(eff, harnesses) };
};
// the spawn row of a startable task: the three pickers fed by the server's catalogue, the
// EFFECTIVE triple the start would run (each value with where it comes from), and the refusal
// the server would answer — shown before the click; the two acts stay disabled while it stands.
function qSpawnRow(id: string): HTMLElement {
  if (!qSpawnUi || qSpawnUi.for !== id) {
    const box = el("div", "qspawn");
    const opts = el("div", "pkdopts qspawnopts");
    const hSel = el("select", "pkdsel") as HTMLSelectElement;
    const mIn = el("input", "pkdin") as HTMLInputElement;
    mIn.type = "text";
    const eSel = el("select", "pkdsel") as HTMLSelectElement;
    const mWrap = labelled("model", mIn);
    const eWrap = labelled("effort", eSel);
    opts.append(labelled("harness", hSel), mWrap, eWrap);
    const fx = el("div", "qspawnfx");
    const block = el("div", "qspawnblock");
    box.append(opts, fx, block);
    const cur = () => qSpawnPick.get(id) ?? Q_SPAWN_EMPTY;
    const option = (value: string, label: string, selected: boolean): HTMLOptionElement => {
      const o = el("option", "", label) as HTMLOptionElement;
      o.value = value;
      o.selected = selected;
      return o;
    };
    hSel.onchange = () => {
      // a level or a model from the harness being left behind must not ride along — same rule as
      // the directory pane's picker. The ROW's stored values are not touched: they are the
      // server's to judge, and the block line says so when they do not fit the new harness.
      const stored = taskSpawnFull.get(id)?.harness;
      const next = hSel.value ? harnesses.find((h) => h.id === hSel.value)
        : stored ? harnesses.find((h) => h.id === stored) : harnesses.find((h) => h.default);
      const c = cur();
      qSpawnPick.set(id, { harness: hSel.value,
        model: next?.supports.model ?? true ? c.model : "",
        effort: !next || (next.supports.effort && next.effortLevels.includes(c.effort)) ? c.effort : "" });
      renderQueueDetail();
    };
    eSel.onchange = () => { qSpawnPick.set(id, { ...cur(), effort: eSel.value }); renderQueueDetail(); };
    // free text: the block line does not depend on it (the server judges the charset), so no
    // repaint per keystroke — only the effective line follows the typing
    mIn.oninput = () => { qSpawnPick.set(id, { ...cur(), model: mIn.value.trim() }); syncFx(); };
    const syncFx = () => {
      const { eff, problem } = qSpawnStateOf(id);
      const dflt = harnesses.find((h) => h.default)?.id;
      const show = (f: QSpawnField, fallback: string) =>
        `${f.value ?? fallback} (${f.origin})`;
      fx.textContent = harnesses.length
        ? `starts as · harness ${show(eff.harness, dflt ? `default ${dflt}` : "default")}`
          + ` · model ${show(eff.model, "default")} · effort ${show(eff.effort, "default")}`
        : "harness catalogue not loaded — the start runs the server's default or the row's own stored choice";
      block.textContent = problem ? `blocked before start: ${problem}` : "";
      block.hidden = !problem;
    };
    const sync = () => {
      const { pick, row, eff } = qSpawnStateOf(id);
      const agents = agentHarnesses();
      opts.hidden = !harnesses.length;
      const dflt = harnesses.find((h) => h.default)?.id;
      hSel.replaceChildren(option("", row?.harness ? `row: ${row.harness}` : `default${dflt ? ` (${dflt})` : ""}`, !pick.harness));
      for (const h of agents) hSel.appendChild(option(h.id, h.id, pick.harness === h.id));
      // the controls follow the EFFECTIVE harness: no model box for an adapter that takes none,
      // no effort list for one without the concept — the visible degradation, never a dead control
      const effH = eff.harness.value === null ? harnesses.find((h) => h.default)
        : harnesses.find((h) => h.id === eff.harness.value);
      mWrap.hidden = !(effH?.supports.model ?? true);
      mIn.placeholder = row?.model ? `row: ${row.model}` : effH?.default && defaultModel ? defaultModel : "default";
      if (mIn.value !== pick.model) mIn.value = pick.model;
      const levels = effH?.supports.effort ? effH.effortLevels : [];
      eWrap.hidden = !levels.length;
      eSel.replaceChildren(option("", row?.effort ? `row: ${row.effort}` : "default", !pick.effort));
      for (const lv of levels) eSel.appendChild(option(lv, lv, pick.effort === lv));
      syncFx();
    };
    qSpawnUi = { for: id, box, sync };
  }
  qSpawnUi.sync();
  return qSpawnUi.box;
}
// the task each row stands for, so keyboard nav selects directly instead of via a synthetic click
let qRowId = new Map<HTMLElement, string | null>();

// The generation GET /api/tasks must match before the detail may make absence claims. The poll can
// announce a new top-level briefAt while the old full cache is still present; treating that cache
// as current would briefly call a stored brief absent.
const qTaskFullKey = () => tasksList.map((t) =>
  `${t.id}:${t.briefAt ?? 0}:${t.criterion?.proposedAt ?? 0}:${t.criterion?.confirmedAt ?? 0}:${t.refine?.at ?? 0}:${t.comments?.n ?? 0}:${t.comments?.at ?? 0}:${t.notes?.n ?? 0}:${t.notes?.at ?? 0}:${t.verdicts?.n ?? 0}:${t.verdicts?.at ?? 0}`
).join(",");
const qTaskFullLoaded = (id: string) => taskText.has(id) && taskTextKey === qTaskFullKey();

// Prompt texts, cached by task id. They are not on the 2 s poll (server.ts TaskDigest) — this
// pulls them once per id-set, only while the window is actually open, and a task's text never
// changes after creation, so a cached entry stays valid until the id disappears.
async function loadTaskTexts() {
  const key = qTaskFullKey();
  if (taskTextBusy || key === taskTextKey) return;
  taskTextBusy = true;
  const epoch = taskTextEpoch;
  let filled = false;
  try {
    const res = await api("/api/tasks");
    if (res.ok) {
      const data = (await res.json()) as { tasks: { id: string; text: string;
        brief?: FullBrief; criterion?: NonNullable<TaskInfo["criterion"]>;
        refine?: TaskRefineFull; comments?: TaskCommentView[]; spawn?: NonNullable<QSpawnRow>;
        notes?: TaskNotePinView[]; verdicts?: TaskNoteVerdictView[] }[] };
      // A brief save can complete while this GET (started before it) is in flight. Never publish
      // that older response under the post-save generation; the retry below fetches the new truth.
      if (epoch === taskTextEpoch) {
        taskText.clear(); // the route returns every task, so this is the whole truth — no stale ids
        taskBriefFull.clear();
        taskCriterionFull.clear();
        taskRefineFull.clear();
        taskCommentsFull.clear();
        taskNotesFull.clear();
        taskVerdictsFull.clear();
        taskSpawnFull.clear();
        for (const t of data.tasks) {
          taskText.set(t.id, t.text);
          if (t.spawn) taskSpawnFull.set(t.id, t.spawn);
          if (t.brief) taskBriefFull.set(t.id, t.brief);
          if (t.criterion) taskCriterionFull.set(t.id, t.criterion);
          if (t.refine) taskRefineFull.set(t.id, t.refine);
          if (t.comments?.length) taskCommentsFull.set(t.id, t.comments);
          if (t.notes?.length) taskNotesFull.set(t.id, t.notes);
          if (t.verdicts?.length) taskVerdictsFull.set(t.id, t.verdicts);
        }
        taskTextKey = key;
        filled = true;
      }
    }
  } catch {
    // server briefly unreachable — rows keep the placeholder, the next poll retries
  }
  taskTextBusy = false;
  if (epoch !== taskTextEpoch) { void loadTaskTexts(); return; }
  // texts arrived: rows AND the open detail carry them now — the detail's criterion textarea
  // renders from taskCriterionFull, which was empty until this very fetch
  if (filled) { qKey = ""; qDetailKey = ""; renderQueue(); renderQueueDetail(); }
}

// --- PROGRAMS: the owner's standing work frames, and whether each still HAS a MAIN ---
// The 2 s poll carries only the digest (id/status/title/createdAt) — a Program body is an
// owner-decision document and deliberately stays off it. The BINDING (`main`) exists only on
// GET /api/programs, which is why that fetch is what makes "does this program still have a
// living MAIN" answerable at all. Fetched while the queue overlay is open, never on a timer of
// its own: the poll's digest set is the change signal, plus a floor for the one rebinding path
// (succession) that moves a binding without moving any digest field.
interface ProgramDigest { id: string; status: string; title: string; createdAt: number }
type PublicProgramFoundingMode = "bootstrap" | "succession";
interface PublicProgramFoundingOccupant { slot: number; openedAt: number }
interface PublicProgramFoundingV1 {
  v: 1; attemptId: string; mode: PublicProgramFoundingMode; canonicalRoot: string;
  target: PublicProgramFoundingOccupant; predecessor: PublicProgramFoundingOccupant | null; startedAt: number;
}
interface PublicProgramFoundingV2 {
  v: 2; profileKind: "standard" | "game-maker"; attemptId: string; mode: PublicProgramFoundingMode;
  targetRoot: string; target: PublicProgramFoundingOccupant;
  predecessor: PublicProgramFoundingOccupant | null; startedAt: number;
}
type PublicProgramFounding = PublicProgramFoundingV1 | PublicProgramFoundingV2;
type ProgramFoundingState = { state: "absent" }
  | { state: "pending"; record: PublicProgramFounding }
  | { state: "unreadable" };
interface ProgramInfo extends ProgramDigest {
  intent?: string; successCriterion?: string;
  // ABSENT or null = unbound. A PRESENT object may still be incomplete, and that is `unknown`,
  // never `live` — see programMark.
  main?: { slot?: number; openedAt?: number; sessionId?: string | null; boundAt?: number } | null;
  // THE OWNER'S SELF-LAND PERMISSION, as it comes off the wire — and every field is optional on
  // purpose. The server stores a closed `{v:1, selfLand, confirmedAt}` and its loader refuses
  // anything else, but a client type is an ASSERTION about a foreign surface, not a proof about
  // one: an older server, a proxy, a hand-edited fleet.json in the reader's path can all put a
  // shape here that this build cannot read. So the type admits that, and `promotionState` below
  // turns "present but unreadable" into its own displayed state rather than into "absent".
  promotion?: { v?: number; selfLand?: string; confirmedAt?: number } | null;
  // THE PROPOSAL'S WISH for that permission, as it comes off the wire, optional for the reason
  // `promotion` above is: an ASSERTION about a foreign surface, not a proof about one. It is only
  // ever present on a PROPOSED program — the confirm spends it and deletes it — and it grants
  // nothing by existing. `promotionRequestState` below turns "present but unreadable" into its own
  // displayed state, because a wish this build cannot read is one the server will drop on confirm,
  // and the owner must not press confirm believing a rung rides along.
  promotionRequest?: { v?: number; selfLand?: string } | null;
  // THE DURABLE FOUNDING MARKER, in the redacted public shape returned by GET /api/programs. V1 and
  // V2 use different root/profile fields, but both expose only the affected occupant pair. Runtime
  // decoding below is deliberately closed: a present shape this build cannot read locks founding
  // as UNKNOWN instead of degrading to an absent marker and offering another bootstrap.
  founding?: PublicProgramFounding | null;
  // THE OWNER'S EXECUTION PROFILE for this program's MAIN, as it comes off the wire, and optional
  // for exactly the reason `promotion` above is: the server stores a closed `{v:1, kind, confirmedAt}`
  // and its loader refuses anything else, but a client type is an ASSERTION about a foreign surface.
  // `profileState` below turns "present but unreadable" into its own displayed state — never into
  // the Standard MAIN, which is what absence means and what an owner would act on.
  profile?: { v?: number; kind?: string; confirmedAt?: number } | null;
  // THE OWNER'S PROGRAM-SCOPED DISPATCH permission, as it comes off the wire, optional for the
  // reason `promotion` and `profile` above are: a client type is an ASSERTION about a foreign
  // surface, not a proof about one. `programDispatchState` below turns "present but unreadable"
  // into its own displayed state — never into absence, which here means "the global switch decides
  // this program alone" and is a thing an owner would act on.
  dispatch?: { v?: number; on?: boolean; maxLanes?: number; confirmedAt?: number } | null;
  // V1b — THE RETURN PATH INTO THIS PROGRAM'S MAIN, derived by the server per request and stored
  // nowhere. Same reason every field above is optional: this is an ASSERTION about a foreign
  // surface, not a proof about one, and an older server simply does not send it. `state` is read
  // as a string rather than a union for the same reason — anything that is not exactly `known`
  // with two numbers is rendered as UNKNOWN, never as room.
  deliveryBudget?: { state?: string; deliveryDebts?: number; armedReservations?: number;
    cap?: number; free?: number; reason?: string } | null;
  // the server's own sentence about that budget, shown verbatim. The Supervisor's senses are
  // handed the same string; a second phrasing here is how two sights of one fact start disagreeing.
  deliveryBudgetNote?: string;
  // V1a — THE BOUND MAIN'S HEALTH, derived by the server per request and stored nowhere. Two
  // halves of one question: `occupancy` (is the binding still on a living occupant — the same
  // fact `programMark` derives locally from the poll) and `sessionIdMatch` (is that occupant
  // still the one that was bound — the half `programMark` cannot check at all). Optional and
  // read as loose strings for the reason every field above is: this is an ASSERTION about a
  // foreign surface, and anything that is not one of the three known words is rendered as
  // unreadable, never as a match.
  health?: { occupancy?: string; sessionIdMatch?: string } | null;
  // D2's additive owner-list projection. `status` is already the persisted Program lifecycle,
  // so the server calls this response-only field `executionStatus`. Every nested value stays
  // optional at this wire boundary: a partial or older response is unreadable, never a zero.
  executionStatus?: {
    main?: { slot?: number | null; occupancy?: string; sessionIdMatch?: string };
    attention?: { open?: number };
    lanes?: { running?: number; queued?: number; waiting?: number };
  } | null;
}

const wireRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
const exactWireKeys = (record: Record<string, unknown>, keys: string[]): boolean =>
  Object.keys(record).length === keys.length && Object.keys(record).every((key) => keys.includes(key));
const publicFoundingOccupant = (value: unknown): PublicProgramFoundingOccupant | null => {
  const record = wireRecord(value);
  if (!record || !exactWireKeys(record, ["slot", "openedAt"])
    || !Number.isInteger(record.slot) || (record.slot as number) < 1
    || typeof record.openedAt !== "number" || !Number.isFinite(record.openedAt) || record.openedAt <= 0) return null;
  return { slot: record.slot as number, openedAt: record.openedAt };
};

// This is the GET /api/programs wire boundary. Undefined alone is absence; null, partial records,
// unknown keys and unknown versions are unreadable PRESENT facts and therefore fail closed.
function programFoundingState(value: unknown): ProgramFoundingState {
  if (value === undefined) return { state: "absent" };
  const record = wireRecord(value);
  if (!record || (record.v !== 1 && record.v !== 2)) return { state: "unreadable" };
  const keys = record.v === 1
    ? ["v", "attemptId", "mode", "canonicalRoot", "target", "predecessor", "startedAt"]
    : ["v", "profileKind", "attemptId", "mode", "targetRoot", "target", "predecessor", "startedAt"];
  if (!exactWireKeys(record, keys)
    || typeof record.attemptId !== "string" || !/^[0-9a-f]{32}$/.test(record.attemptId)
    || (record.mode !== "bootstrap" && record.mode !== "succession")
    || typeof record.startedAt !== "number" || !Number.isFinite(record.startedAt) || record.startedAt <= 0)
    return { state: "unreadable" };
  const target = publicFoundingOccupant(record.target);
  const predecessor = record.predecessor === null ? null : publicFoundingOccupant(record.predecessor);
  if (!target || (record.predecessor !== null && !predecessor)
    || (record.mode === "bootstrap" && predecessor !== null)
    || (record.mode === "succession" && predecessor === null)) return { state: "unreadable" };
  if (record.v === 1) {
    if (typeof record.canonicalRoot !== "string" || record.canonicalRoot.length === 0)
      return { state: "unreadable" };
    return { state: "pending", record: { v: 1, attemptId: record.attemptId,
      mode: record.mode, canonicalRoot: record.canonicalRoot, target, predecessor,
      startedAt: record.startedAt } };
  }
  if ((record.profileKind !== "standard" && record.profileKind !== "game-maker")
    || typeof record.targetRoot !== "string" || record.targetRoot.length === 0)
    return { state: "unreadable" };
  return { state: "pending", record: { v: 2, profileKind: record.profileKind,
    attemptId: record.attemptId, mode: record.mode, targetRoot: record.targetRoot,
    target, predecessor, startedAt: record.startedAt } };
}
let programsPoll: ProgramDigest[] = [];   // the digest set the 2 s poll already carries
let programsList: ProgramInfo[] = [];     // the full rows, from GET /api/programs
let programsRead: "unread" | "ok" | "fail" = "unread";
let programsAt = 0;
let programsBusy = false;
// a forced refetch that arrives DURING a fetch (the bootstrap POST answers while the poll's own
// read is in flight) would otherwise be dropped, and a freshly founded MAIN would keep reading
// `unbound` until the floor elapsed. Exactly one is queued: more would only repeat the same read.
let programsForceQueued = false;
let programsDigestKey = "";
const PROGRAMS_FLOOR_MS = 30_000;
let programsStale = 0;             // fleet-wide count from the 2 s owner poll; absent means zero

async function loadPrograms(force = false): Promise<void> {
  if (programsBusy) { if (force) programsForceQueued = true; return; }
  const digest = JSON.stringify(programsPoll.map((p) => [p.id, p.status, p.title]));
  if (!force && programsRead !== "unread" && digest === programsDigestKey
    && Date.now() - programsAt < PROGRAMS_FLOOR_MS) return;
  programsBusy = true;
  const before = JSON.stringify(programsList);
  const beforeRead = programsRead;
  try {
    const res = await api("/api/programs");
    if (res.ok) {
      const data = (await res.json()) as { programs?: ProgramInfo[] };
      programsList = data.programs ?? [];
      programsRead = "ok";
    } else programsRead = "fail";
  } catch {
    // unreachable server: the section SAYS so. An empty list would read as "no programs".
    programsRead = "fail";
  }
  programsAt = Date.now();
  programsDigestKey = digest;
  programsBusy = false;
  if (programsForceQueued) { programsForceQueued = false; void loadPrograms(true); }
  // repaint only on real change — this runs off the 2 s poll, exactly like loadTaskTexts.
  // `programsRead` counts as a change on its own: unread → ok over an EMPTY list moves no row,
  // but it is the difference between "not read yet" and "there are none", and the composer's
  // hint says exactly that sentence.
  if (JSON.stringify(programsList) !== before || programsRead !== beforeRead) {
    qKey = ""; qDetailKey = ""; renderQueue(); renderQueueDetail();
  }
}

type ProgramMark = "live" | "stale" | "founding" | "unbound" | "unknown";
// The mark is DERIVED here and stored nowhere: the server keeps a binding, not a verdict about
// one. UNKNOWN is a real answer and never softens into live — a missing field or a missing
// snapshot means "cannot be checked", which an owner must not read as a working MAIN.
//
// The session-id half of the binding is deliberately unchecked: /api/sessions exposes no
// top-level sessionId per slot to compare against Program.main.sessionId (the only session id
// on that payload is codexRecovery.sessionId, a claim about codex rollout binding and not the
// same field). The rule is "must match when present on BOTH sides", and the comparable side is
// missing here — so the live sentence names what WAS compared instead of implying more.
//
// FAIL-CLOSED on a failed read: cached rows are context, never a verdict. Only a read that
// currently stands may produce live/stale/unbound; anything else is unknown, and unknown never
// grows a bootstrap button, a live claim or a bindable program in the composer.
function programMark(p: ProgramInfo): { mark: ProgramMark; why: string } {
  if (programsRead !== "ok")
    return { mark: "unknown", why: programsRead === "fail"
      ? "the last GET /api/programs did not answer — this row is CACHED context, not current truth,"
        + " so no binding claim is made from it until a fresh read succeeds"
      : "GET /api/programs has not been read yet, so nothing about this binding is known" };
  const founding = programFoundingState(p.founding);
  if (founding.state === "unreadable")
    return { mark: "unknown", why: "a durable founding field is present but this client cannot read its exact"
      + " public v1/v2 shape — binding and availability are unknown, so bootstrap stays locked" };
  if (founding.state === "pending") {
    const f = founding.record;
    return { mark: "founding", why: `Program-MAIN founding recovery pending — ${f.mode} attempt ${f.attemptId}`
      + ` affects slot ${f.target.slot} (opened ${fmtTs(f.target.openedAt)}); availability unknown, recovery pending,`
      + " and no second bootstrap is available while this durable marker exists" };
  }
  const main = p.main;
  if (main === null || main === undefined)
    return { mark: "unbound", why: "no Program-MAIN binding — nothing has been founded for this program yet" };
  if (typeof main.slot !== "number" || typeof main.openedAt !== "number")
    return { mark: "unknown", why: "the stored binding carries no complete slot+openedAt pair, so it cannot"
      + " be matched against any session — unknown, and unknown is never live" };
  if (!fleet.length)
    return { mark: "unknown", why: "no session snapshot has arrived yet, so there is nothing to match the binding against" };
  const occ = fleet.find((s) => s.id === main.slot);
  if (!occ) return { mark: "stale", why: `the binding names slot ${main.slot}, which this fleet does not have` };
  if (!occ.cwd) return { mark: "stale", why: `slot ${main.slot} is empty — the bound session is gone` };
  if (typeof occ.openedAt !== "number")
    return { mark: "unknown", why: `this server's poll carries no openedAt for slot ${main.slot}, so the binding cannot be checked` };
  if (occ.openedAt !== main.openedAt)
    return { mark: "stale", why: `slot ${main.slot} was reopened since it was bound (bound ${fmtTs(main.openedAt)},`
      + ` current occupant opened ${fmtTs(occ.openedAt)})` };
  return { mark: "live", why: `slot ${main.slot} still holds the bound session (opened ${fmtTs(main.openedAt)});`
    + " slot and openedAt were compared — this poll carries no top-level session id to match"
    + " Program.main.sessionId against, so that half is unchecked HERE. The identity chip beside"
    + " this one carries the server's own comparison of it (V1a)" };
}

interface BootstrapUnavailable {
  availability: "unknown";
  recovery: "pending" | "rolled-back";
  affected: { attemptId: string; slot: number; openedAt: number };
}
const bootstrapUnavailableFrom = (value: unknown): BootstrapUnavailable | null => {
  const record = wireRecord(value);
  const affected = wireRecord(record?.affected);
  if (!record || record.availability !== "unknown"
    || (record.recovery !== "pending" && record.recovery !== "rolled-back")
    || !affected || !exactWireKeys(affected, ["attemptId", "slot", "openedAt"])
    || typeof affected.attemptId !== "string" || !/^[0-9a-f]{32}$/.test(affected.attemptId)
    || !Number.isInteger(affected.slot) || (affected.slot as number) < 1
    || typeof affected.openedAt !== "number" || !Number.isFinite(affected.openedAt)
    || affected.openedAt <= 0) return null;
  return { availability: "unknown", recovery: record.recovery,
    affected: { attemptId: affected.attemptId, slot: affected.slot as number, openedAt: affected.openedAt } };
};

function bootstrapFailureMessage(status: number, value: unknown): string {
  const body = wireRecord(value);
  const base = typeof body?.error === "string" && body.error.length > 0
    ? `${status}: ${body.error}` : `the server answered ${status} with no readable reason`;
  const unavailable = status === 503 ? bootstrapUnavailableFrom(value) : null;
  if (!unavailable) return base;
  return `${base} — availability ${unavailable.availability}; recovery ${unavailable.recovery};`
    + ` affected attempt ${unavailable.affected.attemptId}; affected slot ${unavailable.affected.slot}`
    + ` (opened ${fmtTs(unavailable.affected.openedAt)})`;
}

// --- THE OWNER'S SELF-LAND PROMOTION, read for display ---
// The five states this pane can show, and the reason there are five rather than three. The server
// keeps a three-rung ladder (off / green-only / guarded) and ABSENCE is its fourth, legacy fact —
// "the owner never said" — which its land route refuses in different words from "the owner said
// no". Collapsing those two into one "not granted" would make a revocation look like a program
// nobody ever reached, which is exactly the confusion the record was versioned to prevent. The
// fifth, `unreadable`, exists because this row arrives over the wire: a shape this build cannot
// read as a v1 grant is NOT absence, and rendering it as absence would tell the owner nothing is
// stored while something is.
//
// PURE AND TOP-LEVEL ON PURPOSE: no globals, no DOM, no clock. It is cut out of this source,
// transpiled and RUN over all five states by e2e/programs.ts, the way kProgress and the tree
// painter already are. `stamped` is the SERVER's confirmedAt through fmtTs and nothing else —
// a client-invented time on a permission record would date the owner's act for them.
//
// READABILITY IS THE SERVER'S OWN RULE, restated: v must be 1, selfLand must be in the closed set,
// and confirmedAt must be a positive finite number. server.ts's loadPromotion refuses anything
// else, so a record failing any of those clauses is one the RUNNING SERVER is already treating as
// absent — and this pane must not describe it as a permission that is in force.
type PromotionStateName = "absent" | "off" | "green-only" | "guarded" | "unreadable";
const PROMOTION_RUNGS = ["off", "green-only", "guarded"];
function promotionState(p: ProgramInfo): {
  state: PromotionStateName; label: string; tone: "ok" | "dim" | "warn";
  sentence: string; stamped: string | null;
} {
  const rec = p.promotion;
  if (rec === undefined || rec === null)
    return { state: "absent", label: "self-land: never granted", tone: "dim", stamped: null,
      sentence: "No owner record at all — nothing was ever granted or refused here. The bound MAIN's"
        + " land route refuses in exactly those words, and you land this program's reviewable rows"
        + " from the board, as on every program that has not been promoted." };
  if (typeof rec !== "object" || Array.isArray(rec) || rec.v !== 1
    || typeof rec.selfLand !== "string" || !PROMOTION_RUNGS.includes(rec.selfLand)
    || typeof rec.confirmedAt !== "number" || !Number.isFinite(rec.confirmedAt) || rec.confirmedAt <= 0)
    return { state: "unreadable", label: "self-land: unreadable record", tone: "warn", stamped: null,
      sentence: "A promotion record IS stored on this program, but it is not a shape this build can"
        + " read as a v1 grant — so nothing here says what was granted, and no time is shown because"
        + " an unreadable stamp is not a date. This is not the never-granted case: something is"
        + " stored. The server's own loader refuses the same shape, so its land route is treating"
        + " this program as unpromoted; granting a rung below overwrites the record outright." };
  const stamped = fmtTs(rec.confirmedAt);
  if (rec.selfLand === "off")
    return { state: "off", label: "self-land: off", tone: "dim", stamped,
      sentence: "The record exists and grants nothing — this is you having said NO, not you having"
        + " never said. The bound MAIN is refused exactly as it would be without a record, but the"
        + " fact is a different one: this program was decided, and the decision is dated." };
  if (rec.selfLand === "green-only")
    return { state: "green-only", label: "self-land: green-only", tone: "ok", stamped,
      sentence: "The bound MAIN may land its own reviewable rows, and only through the existing"
        + " clean/fresh-green ladder the board already uses. A lane sitting on an unreviewed"
        + " conflict resolution is still refused — that rung is not in this grant." };
  return { state: "guarded", label: "self-land: guarded", tone: "ok", stamped,
    sentence: "Everything green-only permits, PLUS one rung: a lane sitting on an agent-resolved"
      + " conflict may be confirmed by that MAIN, and the server re-runs the authoritative"
      + " verification FRESH on the resolved candidate, landing only on a green." };
}

// --- THE PROPOSAL'S WISH, read for display AT THE CONFIRM DOOR ---
// It is a SEPARATE function from promotionState and not a parameter on it, because the two answer
// different questions on different rows: that one says what is IN FORCE, this one says what the
// owner is ABOUT TO GRANT by pressing confirm. A permission that is invisible at the moment it is
// handed over is a permission handed over by accident, and that is the whole reason this exists.
//
// FIVE states, the same five, and `unreadable` for promotionState's exact reason with one extra
// edge: a wish the server's own loader refuses is DROPPED on confirm, so a pane that painted it as
// a rung would promise a grant the transition will not make.
//
// PURE AND TOP-LEVEL ON PURPOSE, like promotionState: no globals, no DOM, no clock — it is cut out
// of this source, transpiled and RUN by e2e/programs.ts. There is no `stamped` here at all: a wish
// is not an act, and the only date on this record's life is the one the SERVER writes at confirm.
type PromotionRequestStateName = "absent" | "off" | "green-only" | "guarded" | "unreadable";
function promotionRequestState(p: ProgramInfo): {
  state: PromotionRequestStateName; label: string; tone: "ok" | "dim" | "warn"; sentence: string;
} {
  const rec = p.promotionRequest;
  if (rec === undefined || rec === null)
    return { state: "absent", label: "asks for no self-land rung", tone: "dim",
      sentence: "This proposal carries no wish, so confirming it grants NOTHING and the program"
        + " stays owner-only — the shape every program has had until now. You can still grant a"
        + " rung afterwards through the promotion door on this pane." };
  if (typeof rec !== "object" || Array.isArray(rec) || rec.v !== 1
    || typeof rec.selfLand !== "string" || !PROMOTION_RUNGS.includes(rec.selfLand))
    return { state: "unreadable", label: "asks for an unreadable rung", tone: "warn",
      sentence: "A wish IS stored on this proposal, but it is not a shape this build can read as a"
        + " v1 request. The server's own loader refuses the same shape, so confirming DROPS it and"
        + " grants nothing — this is not the asks-for-nothing case, and it is not a grant either." };
  if (rec.selfLand === "off")
    return { state: "off", label: "asks for self-land: off", tone: "dim",
      sentence: "Confirming stores an explicit, dated NO. Nothing becomes landable — the difference"
        + " from asking for nothing is that the decision exists and can be read back." };
  if (rec.selfLand === "green-only")
    return { state: "green-only", label: "asks for self-land: green-only", tone: "ok",
      sentence: "Confirming GRANTS it in the same act: the bound MAIN may then land its own clean,"
        + " freshly-green rows. An unreviewed conflict resolution stays refused." };
  return { state: "guarded", label: "asks for self-land: guarded", tone: "ok",
    sentence: "Confirming GRANTS the HIGHER rung in the same act: everything green-only permits,"
      + " plus a MAIN-confirmed agent-resolved conflict, which the server re-verifies fresh." };
}

// --- THE OWNER'S PROGRAM-SCOPED DISPATCH PERMISSION, read for display ---
// FOUR states, and `unreadable` is the fourth for exactly the reason promotionState has one: this
// row arrives over the wire, and a shape this build cannot read as a v1 record is NOT absence.
// Absence has a meaning here — the global dispatch switch decides this program alone, i.e. today's
// behaviour — so painting an unreadable record as absence would tell the owner the fleet queue is
// in sole charge while something they cannot see sits on the row.
//
// `off` IS ITS OWN STATE, not a shade of absence: absent is "the owner never said", off is "the
// owner said no". Both refuse identically at the tick, and only this pane and the trail can tell
// you which one you are looking at.
//
// READABILITY IS THE SERVER'S OWN RULE, restated: v must be 1, `on` must be a boolean, `maxLanes`
// must be a whole number in 1..PROGRAM_DISPATCH_MAX_LANES_MAX (server/types.ts, 16 today), and
// confirmedAt must be a positive finite number. A record failing any clause is one the RUNNING
// SERVER already treats as absent.
//
// PURE AND TOP-LEVEL ON PURPOSE, like promotionState and profileState: no globals, no DOM, no
// clock, so e2e/programs.ts can cut it out, transpile it and RUN it over all four states.
type ProgramDispatchStateName = "absent" | "on" | "off" | "unreadable";
const PROGRAM_DISPATCH_MAX_LANES_UI = 16; // mirrors server/types.ts#PROGRAM_DISPATCH_MAX_LANES_MAX
function programDispatchState(p: ProgramInfo): {
  state: ProgramDispatchStateName; label: string; tone: "ok" | "dim" | "warn";
  sentence: string; stamped: string | null;
} {
  const rec = p.dispatch;
  if (rec === undefined || rec === null)
    return { state: "absent", label: "program dispatch: never granted", tone: "dim", stamped: null,
      sentence: "No owner record at all — nothing was ever granted or refused here. This program's"
        + " released rows are started by the fleet dispatcher exactly as every other program's are:"
        + " when the global switch is stopped, nothing of this program starts either." };
  if (typeof rec !== "object" || Array.isArray(rec) || rec.v !== 1
    || typeof rec.on !== "boolean"
    || typeof rec.maxLanes !== "number" || !Number.isInteger(rec.maxLanes)
    || rec.maxLanes < 1 || rec.maxLanes > PROGRAM_DISPATCH_MAX_LANES_UI
    || typeof rec.confirmedAt !== "number" || !Number.isFinite(rec.confirmedAt) || rec.confirmedAt <= 0)
    return { state: "unreadable", label: "program dispatch: unreadable record", tone: "warn", stamped: null,
      sentence: "A dispatch record IS stored on this program, but it is not a shape this build can"
        + " read as a v1 grant — so nothing here says what was granted, and no time is shown because"
        + " an unreadable stamp is not a date. This is not the never-granted case: something is"
        + " stored. The server's own loader refuses the same shape, so its tick is treating this"
        + " program as ungranted; granting below overwrites the record outright." };
  const stamped = fmtTs(rec.confirmedAt);
  if (!rec.on)
    return { state: "off", label: "program dispatch: off", tone: "dim", stamped,
      sentence: "The record exists and grants nothing — this is you having said NO, not you having"
        + " never said. The tick refuses this program's rows under a stopped fleet exactly as it"
        + " would without a record, but the fact is a different one: it was decided, and it is dated." };
  return { state: "on", label: `program dispatch: on · ${rec.maxLanes} lane${rec.maxLanes === 1 ? "" : "s"}`,
    tone: "ok", stamped,
    sentence: `The tick may start THIS program's released rows while the global dispatcher is`
      + ` stopped, up to ${rec.maxLanes} of its lanes at once — and that number can only LOWER the`
      + " machine-wide per-program budget, never raise it. Nothing else is waived: the autos"
      + " kill-switch, the repo lane cap, the per-program lane cap, the harness"
      + " automation bolt and the free-slot requirement all still hold. Quiet hours are stepped"
      + " around for this program's MACHINE-released rows only; an owner-released row still waits." };
}

// --- THE OWNER'S EXECUTION PROFILE, read for display ---
// THREE states, and `unreadable` is the third for exactly the reason promotionState has one: this
// row arrives over the wire, and a shape this build cannot read as a v1 record is NOT absence.
// Absence has a meaning here — it is the Standard MAIN, the unchanged legacy founding — so painting
// an unreadable record as absence would tell the owner they are founding a Standard MAIN while
// something they cannot see sits on the row and the server's own loader is already ignoring it.
//
// READABILITY IS THE SERVER'S OWN RULE, restated: v must be 1, kind must be in the closed set, and
// confirmedAt must be a positive finite number. `stamped` is the SERVER's confirmedAt through
// fmtTs and nothing else — a client clock on an owner decision would date the act for them.
//
// PURE AND TOP-LEVEL ON PURPOSE, like promotionState and programHealthState: no globals, no DOM, no
// clock, so e2e/programs.ts can cut it out, transpile it and RUN it over all three states.
type ProfileAct = "game-maker" | "clear";
type ProfileRequest = {
  path: string;
  body: { profile: { v: 1; kind: "game-maker" } | null };
};
function profileRequestOf(programId: string, act: ProfileAct): ProfileRequest {
  return {
    path: `/api/programs/${programId}/profile`,
    body: act === "game-maker"
      ? { profile: { v: 1, kind: "game-maker" } }
      : { profile: null },
  };
}

type ProfileStateName = "absent" | "game-maker" | "unreadable";
const PROFILE_KINDS = ["game-maker"];
function profileState(p: ProgramInfo): {
  state: ProfileStateName; label: string; tone: "ok" | "dim" | "warn";
  sentence: string; stamped: string | null;
} {
  const rec = p.profile;
  if (rec === undefined || rec === null)
    return { state: "absent", label: "profile: standard MAIN", tone: "dim", stamped: null,
      sentence: "No execution profile is stored, and that is the standard shape every program has"
        + " until you choose otherwise. Its Program-MAIN is founded with the ordinary rail: it"
        + " inspects, decides, decomposes and briefs, and substantial product implementation goes"
        + " to an isolated worker lane." };
  if (typeof rec !== "object" || Array.isArray(rec) || rec.v !== 1
    // the CLOSED key set, and it is the half a display most easily drops: the server's loader
    // refuses an unknown key outright, so a record carrying one is already being ignored by the
    // running server. Rendering it as a live game-maker profile would be this pane's own version
    // of the field-wise repair the loader refuses.
    || Object.keys(rec).some((k) => k !== "v" && k !== "kind" && k !== "confirmedAt")
    || typeof rec.kind !== "string" || !PROFILE_KINDS.includes(rec.kind)
    || typeof rec.confirmedAt !== "number" || !Number.isFinite(rec.confirmedAt) || rec.confirmedAt <= 0)
    return { state: "unreadable", label: "profile: unreadable record", tone: "warn", stamped: null,
      sentence: "An execution profile IS stored on this program, but it is not a shape this build"
        + " can read as a v1 record — so nothing here says which environment was chosen, and no"
        + " time is shown because an unreadable stamp is not a date. This is NOT the standard case:"
        + " something is stored. The server's own loader refuses the same shape, so its next"
        + " founding would use the ordinary rail; granting below overwrites the record outright." };
  const stamped = fmtTs(rec.confirmedAt);
  return { state: "game-maker", label: "profile: game-maker", tone: "ok", stamped,
    sentence: "This program's MAIN is founded as a long-lived Lead Game Developer: it owns the"
      + " playable product and may do substantial serial work itself while play, perception,"
      + " implementation, repair and replay stay indivisible. It may be founded ONLY in a dedicated"
      + " linked git worktree of a target repository, and its succession additionally requires a"
      + " committed \"## Current game checkpoint\" section. A new game or owner-confirmed core pivot"
      + " starts a fresh Architect-to-Review Preflight before implementation; separable, parallel,"
      + " specialist and independent-proof work still goes to a worker lane. The "
      + "Sensory Critic is an operator-run post-play act, not a worker-lane role." };
}

// --- V1a · THE IDENTITY HALF OF THE BOUND MAIN, read for display ---
// WHAT THIS EXISTS TO SHOW. `programMark` above answers "is the bound slot still held" from the
// 2 s poll and says out loud that it cannot answer the other half — the poll carries no session id
// to match `Program.main.sessionId` against. That unchecked half is exactly the one the self-land
// door compares, so until this cut a program could paint `MAIN live` on this pane while every land
// its MAIN attempted came back refused, with the refusal visible only inside that MAIN's own pane.
// The server now derives both halves in one helper (`programHealth`) and hands them to this board
// and to the Supervisor's senses alike; this function does nothing but put the server's answer
// into words.
//
// FOUR DISPLAYED STATES, and `unreadable` is the fourth for the same reason promotionState has one:
// a row that carries no health record (an older server, a proxy, a hand-edited file) is NOT a
// match, and rendering it as one would paint a green identity over an unasked question.
//
// IT IS NOT A LAND VERDICT AND MAY NOT BE READ AS ONE. The land door compares the two recorded
// values DIRECTLY, so both-null (a harness that pins no session id) is an admitted match while a
// null on one side alone is refused — and both label `unknown` here. The door also requires an
// active program, an unambiguous binding and an owner promotion, none of which this pair looks at.
//
// PURE AND TOP-LEVEL ON PURPOSE, like promotionState: no globals, no DOM, no clock — the read
// state is an ARGUMENT rather than a global read, so e2e/programs.ts can cut it out, transpile it
// and RUN it over every state a row can arrive in.
type HealthIdentityName = "exact" | "divergent" | "unknown" | "unreadable";
const HEALTH_MATCHES = ["exact", "divergent", "unknown"];
function programHealthState(p: ProgramInfo, read: "unread" | "ok" | "fail"): {
  state: HealthIdentityName; label: string; tone: "ok" | "dim" | "warn"; sentence: string;
} {
  if (read !== "ok")
    return { state: "unreadable", label: "identity unreadable", tone: "dim",
      sentence: read === "fail"
        ? "The last GET /api/programs did not answer, so no comparison of the bound MAIN's identity"
          + " is current. A cached one would be a claim about a session nobody has looked at since."
        : "GET /api/programs has not been read yet, so nothing about the bound MAIN's identity is"
          + " known — and unknown is never shown as a match." };
  const health = p.health;
  const occupancy = health && typeof health.occupancy === "string" ? health.occupancy : "";
  const match = health && typeof health.sessionIdMatch === "string" ? health.sessionIdMatch : "";
  if (typeof health !== "object" || health === null || !HEALTH_MATCHES.includes(match))
    return { state: "unreadable", label: "identity unreadable", tone: "dim",
      sentence: "This row carries no health record this build can read — an older server does not"
        + " send one at all. That is not a match and not a mismatch: it is a comparison nobody"
        + " made, and it is shown as one." };
  if (match === "divergent")
    return { state: "divergent", label: "identity divergent", tone: "warn",
      sentence: "The occupant holding the bound slot reports a DIFFERENT session id than the"
        + " binding recorded — same slot, same openedAt, a session re-minted inside the pane"
        + " (/clear, resume, respawn). This is the state that costs land rights: POST"
        + " /api/self/tasks/:id/land is refused with \"this session's id does not match the bound"
        + " MAIN identity\" until the owner re-binds the Program-MAIN. Attention and release are"
        + " NOT affected — they report the mismatch rather than gate on it." };
  if (match === "exact")
    return { state: "exact", label: "identity exact", tone: "ok",
      sentence: "The occupant holding the bound slot reports exactly the session id the binding"
        + " recorded — the half the MAIN mark cannot check. The self-land door compares the same"
        + " two values; what else it requires (an active program, an unambiguous binding, an owner"
        + " promotion) is separate and is not answered here." };
  return { state: "unknown", label: "identity unknown", tone: "dim",
    sentence: occupancy === "live"
      ? "One of the two sides records no session id, so there is nothing to compare. This is NOT a"
        + " verdict on the land door: it compares the two values directly, so a harness that pins"
        + " no session id at all (both sides null) is an admitted match, while a null on only one"
        + " side is refused. Which of the two this is, the binding above tells you."
      : `There is no live bound occupant to compare an identity against (occupancy ${occupancy || "unread"}),`
        + " so no comparison is made. A stale binding names an occupant that is gone, and matching"
        + " its recorded id against whoever holds the slot now would answer a question nobody asked." };
}

type ProgramStatusFact = { label: string; tone: "ok" | "dim" | "warn"; sentence: string };
interface ProgramStatusRender {
  facts: ProgramStatusFact[];
  reason: string | null;
}

// The executable rendering model for D2's IN-MEMORY half. It accepts the Program row rather than
// loose counters so omitting `executionStatus` in a fixture takes the same path as an older server:
// one explicit unreadable sentence and no invented zeros. The ledger half cannot be read on this
// owner surface; renderProgramDetail names that boundary beside these facts.
function programStatusRender(p: ProgramInfo, read: "unread" | "ok" | "fail"): ProgramStatusRender {
  if (read !== "ok") return { facts: [], reason: read === "fail"
    ? "The last GET /api/programs did not answer, so the Program status projection is cached and unreadable."
    : "GET /api/programs has not been read yet, so the Program status projection is unknown." };
  const status = p.executionStatus;
  const main = status?.main;
  const attention = status?.attention;
  const lanes = status?.lanes;
  const occupancy = main?.occupancy;
  const slot = main?.slot;
  const sessionIdMatch = main?.sessionIdMatch;
  const open = attention?.open;
  const running = lanes?.running;
  const queued = lanes?.queued;
  const waiting = lanes?.waiting;
  const count = (value: unknown): value is number =>
    typeof value === "number" && Number.isInteger(value) && value >= 0;
  if ((occupancy !== "live" && occupancy !== "stale" && occupancy !== "unbound")
    || (sessionIdMatch !== "exact" && sessionIdMatch !== "divergent" && sessionIdMatch !== "unknown")
    || !(slot === null || (Number.isInteger(slot) && (slot as number) > 0))
    || !count(open) || !count(running) || !count(queued) || !count(waiting))
    return { facts: [], reason: "This Program row carries no complete D2 status projection this build can read; missing values stay unknown." };
  return { reason: null, facts: [
    { label: `MAIN status ${occupancy} · slot ${slot ?? "—"}`,
      tone: occupancy === "live" ? "ok" : occupancy === "stale" ? "warn" : "dim",
      sentence: slot === null ? "the Program has no bound MAIN slot"
        : `the server projects slot ${slot} as ${occupancy}; occupancy is derived from slot and openedAt` },
    { label: `${open} attention open`, tone: open > 0 ? "warn" : "dim",
      sentence: "open or send-uncertain attention rows assigned to this Program" },
    { label: `${running} running`, tone: running > 0 ? "ok" : "dim",
      sentence: "occupied lanes assigned to this Program" },
    { label: `${queued} queued`, tone: queued > 0 ? "warn" : "dim",
      sentence: "queued task rows assigned to this Program" },
    { label: `${waiting} waiting`, tone: waiting > 0 ? "warn" : "dim",
      sentence: "queued Program rows whose dispatcher note starts with waiting:" },
  ] };
}

// the picker's pinned + recent roots as an <input list=> source. Shared by the task composer and
// the Program-MAIN founding flow — both ask for a directory, and a second copy of this fetch
// would be a second thing to keep in step. The inputs work without it: a failed fetch costs the
// dropdown and nothing else.
let repoDatalistAt = 0;
async function ensureRepoDatalist(): Promise<void> {
  if (Date.now() - repoDatalistAt < 60_000) return;
  repoDatalistAt = Date.now();
  try {
    const d = (await (await api(`/api/dirs?path=${encodeURIComponent("~")}`)).json()) as { pins?: string[]; recents?: string[] };
    document.getElementById("qrepodl")?.remove();
    const dl = document.createElement("datalist");
    dl.id = "qrepodl";
    for (const p of [...new Set([...(d.pins ?? []), ...(d.recents ?? [])])]) {
      const o = document.createElement("option");
      o.value = p;
      dl.appendChild(o);
    }
    document.body.appendChild(dl);
  } catch {
    repoDatalistAt = 0; // suggestions only — but let the next open try again
  }
}

// The founding draft. Held here for the same reason qCompose is: a poll may repaint this pane
// (the mark can flip under the cursor), and a locally-created input would eat a half-typed path.
let qBsFor: string | null = null;
let qBsCwd: HTMLInputElement | null = null;
let qBsLabel: HTMLInputElement | null = null;
let qBsHarness: string | null = null;
let qBsModel = "";
let qBsEffort = "";
let qBsErr: string | null = null;  // the server's own sentence, kept verbatim across repaints
let qBsBusy = false;
// The founding POST is the one long await in this pane, and the owner can move on while it runs.
// Every answer therefore carries the generation it was sent under: a bumped generation (a new
// send, a changed selection, a reset draft, a closed overlay) makes an older answer touch NOTHING
// — not the error line, not the two inputs, not the busy flag of the request that replaced it.
// A p.id comparison alone would not do: A → B → A is back at the same id with a different draft.
let qBsSeq = 0;
// The promote draft. It holds no typed text — only the in-flight half of a two-step the owner can
// walk away from mid-way, which is exactly why it carries the founding draft's generation guard.
let qPlFor: string | null = null;
let qPlErr: string | null = null;  // the server's own sentence, kept verbatim across repaints
let qPlBusy = false;
// Same reason as qBsSeq: confirm→activate is two awaits, and a late answer must not write into a
// draft that has since been reset or moved to another program. Generation AND id — A → B → A is
// back at the same id with a different draft.
let qPlSeq = 0;
// The promotion draft, and it is deliberately NOT the promote draft above. Both are owner acts on
// the same pane, but one advances a program's lifecycle and the other grants or takes back a
// PERMISSION — sharing a busy flag would disable a door the owner never touched, and sharing an
// error line would paint one act's refusal under the other's buttons. Same generation guard, same
// reason: the POST is an await the owner can walk away from, and A → B → A is back at the same id.
let qPmFor: string | null = null;
let qPmErr: string | null = null;  // the server's own sentence, kept verbatim across repaints
let qPmBusy = false;
// WHICH act is in flight, not merely THAT one is. Four doors share one busy flag, so a bare flag
// would put "…" on all four and claim three sends nobody made.
let qPmAct: string | null = null;
let qPmSeq = 0;
// The execution-profile draft, and it is a THIRD independent one on the same pane for the reason
// the promotion draft is a second: these are three different owner acts (advance a lifecycle,
// grant a permission, choose an environment), and a shared busy flag or error line would put one
// act's refusal under another act's buttons.
let qPrFor: string | null = null;
let qPrErr: string | null = null;  // the server's own sentence, kept verbatim across repaints
let qPrBusy = false;
let qPrAct: string | null = null;
let qPrSeq = 0;
// The program-dispatch draft, and it is a FOURTH independent one on the same pane for the reason
// the third is: granting the tick permission to START this program's rows is not advancing a
// lifecycle, not granting a land permission and not choosing an environment. A shared busy flag
// would disable a door the owner never touched; a shared error line would paint one act's refusal
// under another act's buttons.
let qPdFor: string | null = null;
let qPdErr: string | null = null;  // the server's own sentence, kept verbatim across repaints
let qPdBusy = false;
let qPdAct: string | null = null;
let qPdSeq = 0;

// the composer's program picker, same once-per-open lifecycle as qRepoIn
let qProgSel: HTMLSelectElement | null = null;

// --- WHAT THE LIST IS ORDERED BY, and why it is no longer `status`.
//
// `pending` vs `queued` is a mechanism detail — it records whether the owner has clicked promote.
// Grouping by it made the queue answer a question nobody asks. The owner's real questions are
// "what needs me", "what did I release", "what is running", and everything else is backlog. So the
// group is DERIVED from status + criterion + kind, in that priority order, and each group is a
// standing answer. Nothing here is persisted: change the rule and every row re-sorts itself.
type QGroup = "needs" | "released" | "running" | "backlog";
const Q_GROUPS: { k: QGroup; head: string; hint: string }[] = [
  { k: "needs", head: "Needs you", hint: "waiting on a decision only you can make" },
  { k: "released", head: "Released — runs next", hint: "you promoted these; the dispatcher takes them in this order" },
  { k: "running", head: "Running", hint: "live in a lane" },
  { k: "backlog", head: "Backlog — about to start", hint: "unreleased work and advisory rows; change an advisory Kind to auftrag before dispatch" },
];
// ADVISORY = every kind the dispatcher refuses, i.e. everything that is not an `auftrag`. Phrased
// as the negative on purpose: a kind added to the server later is advisory here until someone
// decides otherwise, which is the safe direction — the alternative would silently offer ▸ release
// on a row the server answers with 409.
const qAdvisory = (t: TaskInfo): boolean => t.kind !== undefined && t.kind !== "auftrag";
const qClosed = (t: TaskInfo): boolean => t.status === "done" || t.status === "archived";
function qGroupOf(t: TaskInfo): QGroup | null {
  if (qClosed(t)) return null;
  if (t.status === "sent") return "running";
  // an observation is an observation whatever its status says. The check sits ABOVE `queued` on
  // purpose: releasing a note is refused today, but rows promoted before that refusal existed are
  // still in the state file, and showing one under "runs next" would be a promise nothing keeps.
  // It remains visible workbench input, but Backlog is the only honest one of the four work groups.
  if (qAdvisory(t)) return "backlog";
  if (t.status === "queued") return "released";
  // an unconfirmed criterion is a lane parked on YOUR answer
  if (t.criterion && t.criterion.confirmedAt === null) return "needs";
  return "backlog";
}
// The compact brief fact under a row's title. A queue-analyst verdict line stood here until
// 2026-09-10; what is left is the one thing that still decides WHICH BYTES a lane receives.
function qVerdictLine(t: TaskInfo): string {
  if (qAdvisory(t)) return "";
  return t.briefAt ? "brief compiled" : "raw request";
}
const qTaskText = (id: string) => taskText.get(id) ?? "";
// THE ROW NAME. Two rules, both from watching the owner read his own queue and not recognise it.
//
// (1) Cut at the end of a SENTENCE, not at character 120. Every steward filing opens with one
// summarising sentence — and a hard 120-char cut landed mid-word, so the row showed a fragment
// that stopped before the point ("…aus drei regelkonformen Klicks drei L"). The lookbehind keeps
// an abbreviation's dot ("z.B.") from ending the sentence early; the 40-char minimum keeps a
// short opener from becoming the whole name.
//
// (2) Strip the filing tag ("[rundgang 08-05 17:56]"). It is WHO filed and WHEN, which the row's
// second line already carries — at the front of the name it ate 25 of the visible characters
// before the text even started, on every steward row.
const QT_TAG = /^\[([^\]\n]{1,40})\]\s*/;
const qFirstLine = (text: string) => {
  const raw = (text.split("\n")[0] || "…").replace(QT_TAG, "");
  const end = /(?<=[^.\s]{2})[.!?](?=\s|$)/g;
  for (let m = end.exec(raw); m; m = end.exec(raw)) {
    if (m.index + 1 < 40) continue;   // too short to be the summary — keep reading
    if (m.index + 1 > 240) break;     // nothing sentence-shaped in range; fall through to the slice
    const head = raw.slice(0, m.index + 1);
    // a sentence cannot end while a bracket is still open: "(inkl." is an abbreviation, not an end.
    // This is what the two-character lookbehind alone misses — it only catches "z.B."-shaped ones.
    if (head.split("(").length !== head.split(")").length) continue;
    return head;
  }
  return raw.slice(0, 160);
};
const qTag = (text: string) => QT_TAG.exec(text.split("\n")[0] ?? "")?.[1] ?? "";

// SEARCH IS A TASK JOIN, not a text-box convenience. Program title is not carried on a task
// digest, so the client must resolve the task's programId against the already-loaded Program read.
// Every searchable dimension stays in this pure block because e2e/tasks.ts executes it against
// identical task texts; deleting one field makes the corresponding SPEC probe fail.
function qTaskMatches(t: TaskInfo, text: string,
  programs: readonly Pick<ProgramInfo, "id" | "title">[], query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const program = t.programId ? programs.find((candidate) => candidate.id === t.programId) : undefined;
  return [text, t.id, t.status, t.note ?? "", t.repo ?? "", t.programId ?? "", program?.title ?? ""]
    .some((field) => field.toLowerCase().includes(needle));
}

interface QTaskListModel { work: TaskInfo[]; history: TaskInfo[]; showHistoryInWork: boolean }
function qTaskListModel(tasks: TaskInfo[], texts: ReadonlyMap<string, string>,
  programs: readonly Pick<ProgramInfo, "id" | "title">[], query: string): QTaskListModel {
  const needle = query.trim().toLowerCase();
  const matched = tasks.filter((task) => qTaskMatches(task, texts.get(task.id) ?? "", programs, needle));
  const work = matched.filter((task) => !qClosed(task));
  const history = matched.filter(qClosed);
  return { work, history, showHistoryInWork: needle.length > 0 && history.length > 0 };
}

// The row contract is deliberately a tuple, not another free-form middot chain: title plus four
// facts, in the owner-confirmed order. Keeping placement DOM-free makes both completeness and
// order directly testable without opening the dashboard.
type QRowFacts = readonly [verdict: string, age: string, slot: string, sourceTag: string];
// N3 · THE TWO ENDS OF AN ASSIGNMENT, as pure functions — DOM-free for the reason qTaskSummary and
// qTaskListModel are: e2e/tasks.ts executes them against the same rows the server would send, so
// completeness and ordering are checkable without opening a browser.
//
// ABSENCE IS RENDERED AS ITSELF in both. A pinned id no queue row answers is `known: false`, not a
// shorter list; a verdict naming a row that has been capped away keeps its `taskKnown: false`. The
// alternative — dropping either — makes "you were assigned fewer sources" indistinguishable from
// "one of them is unresolvable", and only the second is ever true.
interface QNoteSourceRow { noteId: string; text: string; status: string; by: "owner" | "main"; known: boolean }
function qNoteSourceRows(pins: readonly TaskNotePinView[], rows: readonly TaskInfo[],
  texts: ReadonlyMap<string, string>): QNoteSourceRow[] {
  return pins.map((pin) => {
    const row = rows.find((r) => r.id === pin.noteId);
    const text = texts.get(pin.noteId);
    return { noteId: pin.noteId, by: pin.by, known: !!row, status: row?.status ?? "unknown",
      text: !row ? "(nicht mehr auf der Queue)"
        : text ? noteFirstSentence(text, 160) : "(Text noch nicht geladen)" };
  });
}
interface QNoteVerdictRow { taskId: string; branch: string; verdict: string; text: string; at: number;
  taskKnown: boolean; settled: boolean; landedSha?: string }
function qNoteVerdictRows(verdicts: readonly TaskNoteVerdictView[],
  rows: readonly TaskInfo[]): QNoteVerdictRow[] {
  // newest first, and the tie broken on the KEY so the order is total — two reports written in the
  // same millisecond must not depend on the order the server happened to serialise them in
  return [...verdicts]
    .sort((a, b) => b.at - a.at
      || (a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0)
      || (a.branch < b.branch ? -1 : a.branch > b.branch ? 1 : 0))
    .map((v) => ({ taskId: v.taskId, branch: v.branch, verdict: v.verdict, text: v.text, at: v.at,
      taskKnown: rows.some((r) => r.id === v.taskId),
      // SETTLED means the land of that row happened and this USAGE is finished. It is never a
      // statement about the note's own status — the row below says so in as many words, because
      // "erledigt" beside an open note is exactly the pair a reader would otherwise misread.
      settled: !!v.landedAt, ...(v.landedSha ? { landedSha: v.landedSha } : {}) }));
}

// "beruehrt von n Lands, zuletzt <sha7>" — the note's own line on the queue. Only for a `notiz`:
// on an auftrag the same field would compete with the brief fact, which is the fact that
// decides whether that row can start.
const qTouchedLine = (t: TaskInfo): string => {
  const n = t.touched?.length ?? 0;
  if (t.kind !== "notiz" || n === 0) return "";
  return `beruehrt von ${n} Land${n === 1 ? "" : "s"}, zuletzt ${t.touched![0].sha.slice(0, 7)}`;
};
// the producer chip of a queue row, shared by the row and its detail. Exhaustive on purpose: the
// `never` arm is what turns a new server-side source into a compile error here instead of a label
// that silently falls through to "owner".
// The chip names the PRODUCER and nothing else. It used to append `Task.from`, an intake sender
// label the server took from the public dropbox body — untrusted prose rendered as if it were
// provenance. The field is gone (server/types.ts#Task); the producer is the whole fact.
function taskSourceLabel(t: Pick<TaskInfo, "source">): string {
  switch (t.source) {
    case "owner": return "owner";
    case "intake": return "✉ intake";
    case "steward": return "⚙ steward";
    case "main": return "▣ main";
    default: { const unknown: never = t.source; return String(unknown); }
  }
}
// E4 · "Variante k/n" on a variant row and "Variantengruppe ×n" on its group, each with the decision
// once there is one — which variant lands and which were shelved. Read off the poll alone: the group
// row carries the decision, so a variant finds its verdict through its group in the same list.
function qVariantLine(t: TaskInfo, list: readonly TaskInfo[]): string {
  if (t.variants) {
    const d = t.variantDecision;
    const winner = d ? list.find((x) => x.id === d.winner) : undefined;
    return `Variantengruppe ×${t.variants.length}${d ? ` · Gewinner ${winner?.variantIndex ? `Variante ${winner.variantIndex}` : d.winner}` : ""}`;
  }
  if (!t.variantOf) return "";
  const group = list.find((x) => x.id === t.variantOf);
  const n = group?.variants?.length;
  const d = group?.variantDecision;
  return `Variante ${t.variantIndex ?? "?"}/${n ?? "?"}${d ? (d.winner === t.id ? " · Gewinner" : " · shelved") : ""}`;
}
function qTaskSummary(t: TaskInfo, text: string, now: number): { title: string; facts: QRowFacts } {
  const source = taskSourceLabel(t);
  const tag = qTag(text);
  const variant = qVariantLine(t, tasksList);
  return {
    title: qFirstLine(text),
    facts: [
      // A NOTE'S FIRST FACT IS ITS LIFECYCLE. `qVerdictLine` is empty
      // for every advisory row by construction, so "— advisory" was the whole column — and after
      // N2 there is something to say there: whether any land has moved the ground this observation
      // stands on. Absence keeps the old word, because "nothing recorded" is not "untouched".
      qTouchedLine(t) || qVerdictLine(t) || "— advisory",
      `${fmtDur(Math.max(0, now - t.created))} ago`,
      t.slot ? `slot ${t.slot}` : "no slot",
      [tag ? `${source} / ${tag}` : source, variant].filter(Boolean).join(" · "),
    ],
  };
}

// --- LANE ↔ TASK JOIN — which live lane belongs to which open task row, from the 2 s poll alone.
// The key is the dispatcher's own pointer: the dispatch core writes `task.slot = free.id` in the
// same tick as `slot.taskId = task.id`, and every teardown clears both (server.ts#detachSlotTasks,
// the boot reconciliation of `sent` rows). The poll carries only the TASK-side half — no
// `taskId`/`originId`/`programId`/`sessionId` per slot — so the pointer is the one join this client
// can make, and the guards below are what keep a stale pointer from painting a foreign lane on a row:
//   · status `sent` — the pointer means nothing on any other status (a detached row is `pending`)
//   · slot occupied AND a worktree — a recycled slot holding a plain checkout is not a lane
//   · openedAt ≥ task.created — a session opened before the row existed cannot be its lane
//   · repo — the row's target (or the dispatch default) against the lane's canonical toplevel. The
//     digest carries the path AS WRITTEN and the slot the RESOLVED one, so equality (or a
//     subdirectory of the toplevel) is a match, a segment-aligned suffix (/var/x vs /private/var/x)
//     is an ALIAS this client cannot resolve and says so, and anything else is FOREIGN — refused.
//   · program — UNCHECKED HERE: the poll carries no programId per slot. Said on the line, never
//     read as a match. (The originId fallback is not derivable either, for the same reason.)
// Each slot attaches to at most one row: two `sent` rows naming one slot attach to neither, so a
// lane appears on the workbench zero or one times, never twice.
interface QLaneSlot { id: number; cwd: string | null; openedAt?: number; lastOutput: number;
  git?: { dirty: number; ahead: number } | null; worktree?: { repo: string; branch: string } | null }
interface QLaneTask { id: string; status: TaskInfo["status"]; created: number; slot?: number;
  repo?: string; programId?: string }
// `state` is the activity word; `dirty` rides beside it so "idle with uncommitted work" is said as
// both facts, not folded into one. done-looking is the GIT half of lane-signals' predicate (idle,
// clean, ahead>0) — alive, git-op and merge status are not on this poll and stay unchecked.
type QLaneState = "running" | "idle" | "done-looking" | "unknown";
interface QLaneFacts { state: QLaneState; quietMs: number | null; dirty: number | null; ahead: number | null }
interface QLaneView extends QLaneFacts { slot: number; branch: string; repo: "match" | "alias";
  program: "unchecked" | "none" }
type QLaneJoin = { kind: "lane"; lane: QLaneView } | { kind: "none" }
  | { kind: "refused"; slot: number; why: string };
// mirrors the server's FLEET_AUTO_REVIEW_IDLE_MS default — a claim about a foreign surface, which
// is why the line prints the quiet time itself and never only the word derived from it
const Q_LANE_IDLE_MS = 60_000;
function qLaneState(s: QLaneSlot, now: number): QLaneFacts {
  // lastOutput 0 = the pane was never observed; now 0 = no poll has stamped a clock yet. Either
  // is UNKNOWN — a quiet time computed from it would be a number, and a wrong one.
  const quietMs = s.lastOutput > 0 && now > 0 ? Math.max(0, now - s.lastOutput) : null;
  const git = s.git ?? null;
  const dirty = git ? git.dirty : null;
  const ahead = git ? git.ahead : null;
  if (quietMs === null || git === null) return { state: "unknown", quietMs, dirty, ahead };
  const idle = quietMs >= Q_LANE_IDLE_MS;
  if (!idle) return { state: "running", quietMs, dirty, ahead };
  return { state: git.dirty === 0 && git.ahead > 0 ? "done-looking" : "idle", quietMs, dirty, ahead };
}
const qPathNorm = (p: string): string => p.replace(/\/+$/, "");
function qRepoRelation(taskRepo: string | null, laneRepo: string): "match" | "alias" | "foreign" | "unknown" {
  if (!taskRepo) return "unknown";
  const a = qPathNorm(taskRepo);
  const b = qPathNorm(laneRepo);
  if (a === b || a.startsWith(`${b}/`)) return "match";
  // both are absolute, so a suffix match is segment-aligned by construction (/var/x ⊂ /private/var/x)
  if (a.endsWith(b) || b.endsWith(a)) return "alias";
  return "foreign";
}
function qLaneJoins(tasks: readonly QLaneTask[], slots: readonly QLaneSlot[],
  dispatchRepo: string, now: number): Map<string, QLaneJoin> {
  const claims = new Map<number, number>();
  for (const t of tasks) if (t.status === "sent" && typeof t.slot === "number")
    claims.set(t.slot, (claims.get(t.slot) ?? 0) + 1);
  const out = new Map<string, QLaneJoin>();
  for (const t of tasks) {
    if (t.status !== "sent" || typeof t.slot !== "number") { out.set(t.id, { kind: "none" }); continue; }
    const slot = t.slot;
    const refuse = (why: string): void => { out.set(t.id, { kind: "refused", slot, why }); };
    const s = slots.find((x) => x.id === slot);
    if (!s || !s.cwd) { refuse("the slot is empty — its lane is gone"); continue; }
    if (!s.worktree) { refuse("the slot now holds a plain checkout, not a lane — recycled"); continue; }
    if ((claims.get(slot) ?? 0) > 1) { refuse("two open rows name this slot — attached to neither"); continue; }
    if (typeof s.openedAt !== "number" || !(s.openedAt > 0)) {
      refuse("the poll carries no openedAt for this slot — cannot tell whether its session is older than this row");
      continue;
    }
    if (s.openedAt < t.created) { refuse("the slot's session was opened before this row existed — a recycled pointer"); continue; }
    const target = t.repo ?? (dispatchRepo || null);
    const rel = qRepoRelation(target, s.worktree.repo);
    if (rel === "foreign") { refuse(`the lane is in ${s.worktree.repo}, foreign to this row's target ${target}`); continue; }
    if (rel === "unknown") { refuse("this row names no target repo and no dispatch default is known"); continue; }
    out.set(t.id, { kind: "lane", lane: { slot, branch: s.worktree.branch, repo: rel,
      program: t.programId ? "unchecked" : "none", ...qLaneState(s, now) } });
  }
  return out;
}

function qWaveProjection(): TaskWaveProjection {
  return projectTaskWaves({
    tasks: tasksList.map((t) => ({
      id: t.id, repo: t.repo, kind: t.kind, status: t.status, created: t.created,
      files: t.files, filesOrigin: t.filesOrigin,
    })),
    dispatchRepo: dispatch.repo,
    maxLanes: dispatch.maxLanes,
  });
}

// Every fact that can change the pure projection. Status does not pay this key's cost; Waves does,
// so a normal poll that changed only an unrelated slot does not rebuild the queue list.
// Mediane 2026-09, docs/messungen/2026-09-06-merge-prozess-robust.md §1 — what the board charges
// for one avoided land. Held in the module both this view and `bun task-land-waves.ts --state`
// read, so the CLI check the MAIN runs after a land prices a wave exactly as this list showed it.
const Q_LAND_WAVE_COSTS: LandWaveCosts = LAND_WAVE_COSTS_2026_09;

// WHICH WAVE THE OWNER HAS ACKNOWLEDGED THE CAVEAT FOR, keyed by its id set. Per wave and not a
// single flag: the caveat is about THESE rows belonging together, so acknowledging one wave must
// never arm the button on the next. Cleared with the queue pane, like qRawAck beside it.
let qWaveAck: string | null = null;
const qWaveKey = (ids: readonly string[]): string => ids.join("+");

// The LANDE fold of the same facts: which rows could land TOGETHER (task-land-waves.ts), beside
// the parallel fold above. Read-only — there is no button here and no dispatch reads it.
function qLandWaveProjection(): LandWaveProjection {
  return projectLandWaves({
    tasks: tasksList.map((t) => ({
      id: t.id, repo: t.repo, kind: t.kind, status: t.status, created: t.created,
      files: t.files, filesOrigin: t.filesOrigin, programId: t.programId, size: t.size,
      // the server's own fold reads both (server.ts#landWaveProjectionNow): a variant is a wave of
      // one and a group is in no wave, so the board never offers a bundle the door would refuse
      ...(t.variantOf ? { variantOf: t.variantOf } : {}), ...(t.variants ? { variantGroup: true as const } : {}),
    })),
    dispatchRepo: dispatch.repo,
    ...(dispatch.waveBudget ? { budget: dispatch.waveBudget } : {}),
    costs: Q_LAND_WAVE_COSTS,
  });
}

// ▸ START WAVE (W3) — the evidence, the caveat and the button, in that order, appended to the
// sensor line of a wave with n>1.
//
// WHAT IT SHOWS THE OWNER, and why exactly this. A wave stands on TWO STRUCTURAL criteria — the
// same Program and a confirmed, overlapping file surface — and Program eec69528's objection to
// that pairing is correct as far as it goes: neither criterion says anything about the rows having
// a common CAUSE. The owner decided programId as the second criterion, so the resolution is not to
// add a third one here but to put the whole basis of the bundle in front of him before he commits
// n rows to one lane: every row's first sentence, the files at least two of them actually share,
// the class the gate will run, and the seconds the avoided lands are priced at. The caveat line
// then says in as many words what nothing in this projection checked, and the checkbox makes
// acknowledging it a deliberate act rather than a hover title nobody on a phone ever sees.
function qLandWaveStart(line: HTMLElement, wave: LandWave): void {
  const key = qWaveKey(wave.ids);
  const ev = el("div", "qwaveev");
  for (const id of wave.ids) {
    // The TEXT rides GET /api/tasks, never the 2 s poll — so a row whose text has not arrived yet
    // is shown as the absence it is, and the list repaints when it does (`taskText.has` is already
    // in this view's render key). Inventing an empty line would read as an empty request.
    const text = qTaskText(id);
    ev.appendChild(el("div", "", `${id} — ${text ? noteFirstSentence(text, 160) : "(Text noch nicht geladen)"}`));
  }
  ev.appendChild(el("div", "qwaveevf", wave.sharedFiles.length
    ? `gemeinsame Dateien: ${wave.sharedFiles.join(", ")}`
    : "keine Datei wird von zwei dieser Zeilen genannt"));
  line.appendChild(ev);

  const ack = el("label", "qrawack");
  const box = el("input", "") as HTMLInputElement;
  box.type = "checkbox";
  box.checked = qWaveAck === key;
  box.onchange = () => { qWaveAck = box.checked ? key : null; renderQueue(); };
  ack.appendChild(box);
  ack.appendChild(el("span", "", "was hier NICHT geprüft wurde: dass diese Aufträge inhaltlich"
    + " zusammengehören. Gebündelt wird auf Program und bestätigter Datei-Fläche — beides"
    + " strukturell. Der Gewinn ist EIN Gate und EIN Audit statt " + wave.ids.length + ";"
    + " der Preis ist, dass ein rotes Stufe-2-Audit über alle " + wave.ids.length
    + " Zeilen von Hand zuzuordnen ist."));
  line.appendChild(ack);

  const b = el("button", "shrbtn", "▸ start wave") as HTMLButtonElement;
  b.disabled = qWaveAck !== key;
  b.title = b.disabled
    ? "acknowledge the line above first — the bundle is structural, and only you can judge whether these rows belong together"
    : `opens ONE lane on ${wave.ids.length} rows; it commits one commit per row and lands once`;
  b.onclick = () => void qStartWave(wave);
  line.appendChild(b);
}

async function qStartWave(wave: LandWave): Promise<void> {
  const r = await post("/api/wave/dispatch", { ids: wave.ids });
  if (!r.ok) {
    // the server's own sentence, never a generic failure: "these rows are not one of the sensor's
    // land waves right now" is the one refusal a stale board actually produces, and it names why
    const j = (await r.json().catch(() => null)) as { error?: string } | null;
    toast(j?.error ?? "couldn't start the wave");
    return;
  }
  qWaveAck = null;
  await refresh();
}

function qWaveProjectionKey(): string {
  return JSON.stringify([
    dispatch.repo, dispatch.maxLanes,
    tasksList.map((t) =>
      [t.id, t.repo, t.kind, t.status, t.created, t.files, t.filesOrigin, t.programId]),
  ]);
}

type QWaveLocation =
  | { kind: "wave"; item: ProjectedWaveTask; repo: string; wave: number }
  | { kind: "unresolved"; item: TaskWaveUnresolved };
function qWaveLocation(id: string, projection: TaskWaveProjection): QWaveLocation | null {
  for (const repo of projection.repos) for (const wave of repo.waves) {
    const item = wave.tasks.find((task) => task.id === id);
    if (item) return { kind: "wave", item, repo: repo.repo, wave: wave.index };
  }
  const unresolved = projection.unresolved.find((task) => task.id === id);
  return unresolved ? { kind: "unresolved", item: unresolved } : null;
}

function qTextDraft(current: QTextDraft | null, id: string, seed: string, rows: number): QTextDraft {
  if (!current || current.for !== id) {
    const box = el("textarea", "qdcrit") as HTMLTextAreaElement;
    const draft: QTextDraft = { for: id, box, seed, dirty: false };
    box.value = seed;
    box.rows = rows;
    box.addEventListener("input", () => { draft.dirty = true; });
    return draft;
  }
  if (!current.dirty && current.seed !== seed) {
    current.box.value = seed;
    current.seed = seed;
  }
  current.box.rows = rows;
  return current;
}

// returns whether the action actually took: the comment box clears its draft on the strength of
// this, and clearing on a failed post is how a typed remark gets lost with nothing to show for it
async function qAct(id: string, action: string, body: Record<string, unknown> = {}): Promise<boolean> {
  const r = await post(`/api/tasks/${id}/${action}`, body);
  if (!r.ok) {
    // surface the server's reason — "no free slot" and "task is running in a lane" are
    // actionable, a generic failure line is not
    const j = (await r.json().catch(() => null)) as { error?: string } | null;
    toast(j?.error ?? `couldn't ${action} the task`);
    return false;
  }
  if (action === "delete" && qPick === id) qPick = null;
  // a started row is no longer startable: its pick has been sent and must not resurface later
  if (action === "dispatch") qSpawnPick.delete(id);
  // applying or discarding consumes the proposal server-side; drop the local copy in the same
  // beat, or the detail paints one stale frame of a proposal that no longer exists (the /api/tasks
  // refetch that would correct it is a poll behind)
  if (action === "refine-confirm") taskRefineFull.delete(id);
  // briefAt will invalidate every polling browser. The local epoch additionally rejects a full GET
  // that started before THIS save and returns before that next poll; the warning stays neutral until
  // the post-save full row arrives.
  if (action === "brief") { taskTextEpoch++; taskTextKey = ""; }
  await refresh();
  qKey = ""; // this changed the data — force the list to rebuild even inside the poll's guard
  renderQueue();
  renderQueueDetail();
  return true;
}

function qDetailSection(parent: HTMLElement, title: string, disclosure = false, open = true): HTMLElement {
  const section = document.createElement(disclosure ? "details" : "section");
  section.className = "qdsection";
  if (section instanceof HTMLDetailsElement) section.open = open;
  section.appendChild(el(disclosure ? "summary" : "div", "qdsection-title", title));
  const body = el("div", "qdsection-body");
  section.appendChild(body);
  parent.appendChild(section);
  return body;
}

// One program, in the SAME list/detail pane the tasks use. What it must make impossible is the
// state this surface was built for: a program whose MAIN died months ago reading like a running
// one. So the mark, its derivation sentence, and the founding flow all sit on one pane.
function renderProgramDetail(shell: Shell, id: string): void {
  const p = programsList.find((x) => x.id === id);
  if (!p) {
    shell.detail.appendChild(el("div", "shellhint", programsRead === "fail"
      ? "GET /api/programs did not answer — this row cannot be read right now"
      : "that program is gone — it was discarded or completed"));
    return;
  }
  const { mark, why } = programMark(p);
  shell.detail.appendChild(el("div", "rvhead", p.title));
  const facts = el("div", "ocfacts");
  facts.appendChild(chip(p.status, p.status === "active" ? "ok" : "dim",
    "the program's own lifecycle status — proposed → confirmed → active → complete"));
  facts.appendChild(chip(`MAIN ${mark}`,
    mark === "live" ? "ok" : mark === "unbound" ? "dim" : "warn", why));
  if (p.main && typeof p.main.slot === "number")
    facts.appendChild(chip(`slot ${p.main.slot}`, "dim",
      `the stored binding names slot ${p.main.slot}${typeof p.main.boundAt === "number" ? `, bound ${fmtTs(p.main.boundAt)}` : ""}`));
  // V1a — THE IDENTITY HALF, on every row and on every read state, because the question it answers
  // ("is the occupant still the one that was bound") has no other answer on this pane and its
  // absence reads as a yes. Unconditional on purpose, unlike the return-path chip below: that one
  // is a NUMBER that would go stale, this one degrades to its own `unreadable` state instead.
  const hs = programHealthState(p, programsRead);
  facts.appendChild(chip(hs.label, hs.tone, hs.sentence));
  facts.appendChild(chip(fmtTs(p.createdAt), "dim", "when this program was created"));
  // V1b — THE RETURN PATH, on the pane that already answers "can this MAIN still be reached". A
  // MAIN whose FleetEvent delivery budget is full has closed the way back to itself: every fleet
  // report and every clarification from its lanes is refused, and that 409 used to be visible only
  // inside the lane that got it. Rendered ONLY while a read stands, because this is the one number
  // here that moves without any program field moving — a cached one would read as current room.
  const budgetNote = programsRead === "ok" && typeof p.deliveryBudgetNote === "string"
    ? p.deliveryBudgetNote : "";
  const budget = p.deliveryBudget;
  const room = programsRead === "ok" && !!budget && budget.state === "known"
    && typeof budget.free === "number" && typeof budget.cap === "number"
    ? { free: budget.free, cap: budget.cap } : null;
  if (budgetNote)
    facts.appendChild(chip(room ? `return path ${room.free}/${room.cap}` : "return path unknown",
      !room ? "dim" : room.free === 0 ? "warn" : "ok",
      `${budgetNote} — as read at ${fmtTs(programsAt)}`));
  shell.detail.appendChild(facts);
  shell.detail.appendChild(el("div", "shellhint", why));
  // the sentence itself, not only as a tooltip, exactly where it costs something: a closed return
  // path and an unreadable one are the two states an owner must not scroll past.
  if (budgetNote && (!room || room.free === 0))
    shell.detail.appendChild(el("div", "shellhint", budgetNote));
  // …and the identity sentence in full where it COSTS something: a divergent identity is a MAIN
  // whose lands are already being refused, and a tooltip is not where an owner finds that out.
  if (hs.state === "divergent") shell.detail.appendChild(el("div", "pkdwarn", hs.sentence));

  const projected = programStatusRender(p, programsRead);
  const status = qDetailSection(shell.detail, "Program status");
  if (projected.reason) status.appendChild(el("div", "pkdwarn", projected.reason));
  else {
    const statusFacts = el("div", "ocfacts");
    for (const fact of projected.facts)
      statusFacts.appendChild(chip(fact.label, fact.tone, fact.sentence));
    status.appendChild(statusFacts);
  }
  status.appendChild(el("div", "shellhint",
    "This owner list carries D2's in-memory projection only. lastLand, lastAudit and deploy exist"
    + " only on the bound MAIN's self projection, so this board cannot attribute or render them."));

  if (p.intent || p.successCriterion) {
    const frame = qDetailSection(shell.detail, "Frame", true, false);
    if (p.intent) { frame.appendChild(el("div", "rvhead", "intent")); frame.appendChild(el("div", "qdtext", p.intent)); }
    if (p.successCriterion) {
      frame.appendChild(el("div", "rvhead", "success criterion"));
      frame.appendChild(el("div", "qdtext", p.successCriterion));
    }
  }

  // THE EXECUTION ENVIRONMENT, ON THE PANE THAT OWNS IT — and above the promotion door because it
  // is the earlier decision: the profile chooses what the NEXT founding builds, the promotion
  // chooses what a MAIN may then do. Two explicit acts and nothing implied: nothing is preselected,
  // nothing is submitted on render, and no kind is inferred from the program's status or repo.
  //
  // IT SITS ABOVE THE STALE/UNKNOWN EARLY RETURN for the same reason the promotion door does, and
  // with a sharper edge: a program whose MAIN died is EXACTLY the program whose next founding
  // should use a fresh owner decision, and the server keeps it writable for that reason. Hiding
  // the door there would strand the choice where nothing can restate it.
  {
    if (qPrFor !== p.id) {
      qPrFor = p.id;
      qPrSeq++; // a DIFFERENT program; anything still in flight for the old one is orphaned
      qPrErr = null; qPrBusy = false; qPrAct = null;
    }
    const forPrId = p.id;
    const prSt = profileState(p);
    const prNoAnswer = (act: ProfileAct) =>
      `${act} did not reach the server — no answer came back, so whether this profile changed is unknown`;
    const prRun = async (act: ProfileAct): Promise<void> => {
      const seq = ++qPrSeq;
      const mine = () => seq === qPrSeq && qPrFor === forPrId;
      qPrBusy = true; qPrErr = null; qPrAct = act;
      qDetailKey = ""; renderQueueDetail();
      let err: string | null = null;
      // moved-UNKNOWN, exactly as the two doors below count it: an unanswered request may well have
      // been applied, so the facts are re-read instead of the old state being repainted over a
      // record that has in truth already changed.
      let moved = false;
      try {
        const request = profileRequestOf(forPrId, act);
        const r = await post(request.path, request.body).catch(() => null);
        if (!r) { err = prNoAnswer(act); moved = true; }
        else if (r.ok) moved = true;
        else {
          const j = (await r.json().catch(() => null)) as { error?: string } | null;
          err = j?.error ? `${act} failed — ${r.status}: ${j.error}`
            : `${act} failed — the server answered ${r.status} with no readable reason`;
        }
      } finally {
        if (mine()) {
          qPrBusy = false; qPrAct = null;
          qPrErr = err;
          if (moved) await loadPrograms(true);
          qKey = ""; qDetailKey = "";
          renderQueue(); renderQueueDetail();
        } else if (moved) {
          await loadPrograms(true); qKey = ""; renderQueue();
        }
      }
    };

    const pr = qDetailSection(shell.detail, "Execution profile");
    const prFacts = el("div", "ocfacts");
    prFacts.appendChild(chip(prSt.label, prSt.tone, prSt.sentence));
    // THREE labels for three states, because two would lie in the third. "no profile chosen" is a
    // statement about ABSENCE; saying it over an unreadable record would tell the owner nothing is
    // stored while something is — the exact confusion profileState exists to prevent.
    prFacts.appendChild(chip(
      prSt.stamped ? `chosen ${prSt.stamped}`
        : prSt.state === "unreadable" ? "no readable profile stamp" : "no profile chosen", "dim",
      prSt.stamped ? "the server's own confirmedAt on this record — it stamps the act, no client clock is involved"
        : prSt.state === "unreadable"
          ? "a record IS stored, but this build cannot read its stamp — an unreadable stamp is not a date"
          : "no record is stored at all, so there is no date to show"));
    pr.appendChild(prFacts);
    pr.appendChild(el("div", "shellhint", prSt.sentence));
    pr.appendChild(el("div", "shellhint",
      `POST /api/programs/${p.id}/profile — the owner-only door, and the only writer of this record.`
      + " It is FIXED while a live bound MAIN holds this program, and on a complete program, because"
      + " that session was founded under it; a stale or unbound active program stays writable so the"
      + " next founding uses a fresh decision. Every refusal below is the server's own sentence."));
    if (programsRead !== "ok") pr.appendChild(el("div", "pkdwarn",
      "the last GET /api/programs did not answer — the state above is CACHED context, not current"
      + " truth. The two acts below still reach the server and are safe to repeat."));
    if (qPrErr) pr.appendChild(el("div", "pkdwarn", qPrErr));
    const prActs = el("div", "pkdacts");
    prActs.style.marginTop = "10px";
    const prButtons: [ProfileAct, string, string, string][] = [
      ["game-maker", "grant game-maker", "shrbtn primary",
        "the next founding builds a Lead Game Developer MAIN — only in a dedicated linked worktree of a target repo"],
      ["clear", "clear", "shrbtn danger",
        "back to the standard MAIN; clearing an absent record is an ordinary success"],
    ];
    for (const [act, label, cls, tip] of prButtons) {
      const b = el("button", cls, qPrBusy && qPrAct === act ? `${label}…` : label) as HTMLButtonElement;
      b.disabled = qPrBusy;
      b.title = tip;
      b.onclick = () => { void prRun(act); };
      prActs.appendChild(b);
    }
    pr.appendChild(prActs);
  }

  // THE PERMISSION, ON THE PANE THAT OWNS IT. POST /api/programs/:id/promotion existed with no
  // owner surface at all, so the only way to grant or take back a MAIN's self-land authority was a
  // curl with the owner token — a shape in which the four acts are indistinguishable typos of each
  // other. It sits ABOVE the stale/unknown early return on purpose: a program whose MAIN died is
  // exactly a program whose standing permission an owner may want to take back, and that return
  // would hide the only door that can.
  //
  // FOUR EXPLICIT ACTS AND NOTHING IMPLIED. Nothing is preselected, nothing is submitted on render,
  // and no rung is inferred from the program's status: this is a permission, and a permission that
  // arrives by default is one nobody granted. The prose may say which rung is the ordinary choice;
  // it must never be the one already pressed.
  {
    if (qPmFor !== p.id) {
      qPmFor = p.id;
      qPmSeq++; // a DIFFERENT program; anything still in flight for the old one is orphaned
      qPmErr = null; qPmBusy = false; qPmAct = null;
    }
    const forPmId = p.id;
    const st = promotionState(p);
    // THE FOUR BODIES, WRITTEN OUT. The server reads a CLOSED set — any extra top-level key is a
    // 400 and an unknown key inside the policy is a 400 — so the shapes are stated here as data
    // rather than assembled from the button that was clicked. A body built by concatenation is a
    // body a later edit can widen without anyone reading this pane again.
    type PmAct = "green-only" | "guarded" | "off" | "revoke";
    const PM_BODY: Record<PmAct, { policy: { v: 1; selfLand: string } | null }> = {
      "green-only": { policy: { v: 1, selfLand: "green-only" } },
      guarded: { policy: { v: 1, selfLand: "guarded" } },
      off: { policy: { v: 1, selfLand: "off" } },
      revoke: { policy: null },
    };
    // A REQUEST THAT GOT NO ANSWER is a third outcome, not a refusal — same reason as the promote
    // door below: no status came back, so none is invented, and the sentence says the outcome is
    // unknown rather than claiming the permission did or did not change.
    const pmNoAnswer = (act: PmAct) =>
      `${act} did not reach the server — no answer came back, so whether this permission changed is unknown`;
    const pmRun = async (act: PmAct): Promise<void> => {
      const seq = ++qPmSeq;
      const mine = () => seq === qPmSeq && qPmFor === forPmId;
      qPmBusy = true; qPmErr = null; qPmAct = act;
      qDetailKey = ""; renderQueueDetail();
      let err: string | null = null;
      // moved-UNKNOWN, exactly as the promote door counts it: an unanswered request may well have
      // been applied, so the facts are re-read instead of the old state being repainted over a
      // permission that has in truth already changed.
      let moved = false;
      try {
        const r = await post(`/api/programs/${forPmId}/promotion`, PM_BODY[act]).catch(() => null);
        if (!r) { err = pmNoAnswer(act); moved = true; }
        else if (r.ok) moved = true;
        else {
          const j = (await r.json().catch(() => null)) as { error?: string } | null;
          err = j?.error ? `${act} failed — ${r.status}: ${j.error}`
            : `${act} failed — the server answered ${r.status} with no readable reason`;
        }
      } finally {
        // EVERY exit clears the busy flag, fenced by mine(): a flag set by a NEWER run belongs to
        // that run, and an orphan must not enable a door that is in flight.
        if (mine()) {
          qPmBusy = false; qPmAct = null;
          qPmErr = err;
          if (moved) await loadPrograms(true);
          qKey = ""; qDetailKey = "";
          renderQueue(); renderQueueDetail();
        } else if (moved) {
          await loadPrograms(true); qKey = ""; renderQueue();
        }
      }
    };

    const pm = qDetailSection(shell.detail, "Self-land promotion");
    const pmFacts = el("div", "ocfacts");
    pmFacts.appendChild(chip(st.label, st.tone, st.sentence));
    pmFacts.appendChild(chip(st.stamped ? `granted ${st.stamped}` : "never granted", "dim",
      st.stamped ? "the server's own confirmedAt on this record — it stamps the act, no client clock is involved"
        : "no readable grant is stored, so there is no date to show"));
    pm.appendChild(pmFacts);
    pm.appendChild(el("div", "shellhint", st.sentence));
    pm.appendChild(el("div", "shellhint",
      `POST /api/programs/${p.id}/promotion — the owner-only door, and the only writer of this`
      + " record. green-only is the ordinary grant: it ends the routine attention on a clean land"
      + " without handing over an unreviewed conflict. Each act below is sent on its own click,"
      + " nothing is preselected, and every refusal is the server's own sentence, word for word."));
    // …and the honest caveat where the row is CACHED. programMark already fails closed on a failed
    // read; the promotion shown here comes off the same row, so it inherits the same doubt. The
    // acts still go to the server, which is why they stay enabled.
    if (programsRead !== "ok") pm.appendChild(el("div", "pkdwarn",
      "the last GET /api/programs did not answer — the state above is CACHED context, not current"
      + " truth. The four acts below still reach the server and are safe to repeat."));
    if (qPmErr) pm.appendChild(el("div", "pkdwarn", qPmErr));
    const pmActs = el("div", "pkdacts");
    pmActs.style.marginTop = "10px";
    // Safely repeatable by construction: granting the rung already stored re-stamps the same
    // permission, and revoking an absent record is the server's own idempotent no-op. Neither
    // needs a confirmation dialog, and this pane has none to offer.
    const pmButtons: [PmAct, string, string, string][] = [
      ["green-only", "grant green-only", "shrbtn primary",
        "the MAIN lands its own clean/fresh-green rows; an unreviewed conflict resolution stays refused"],
      ["guarded", "grant guarded", "shrbtn",
        "green-only plus the MAIN-confirmed conflict-resolution rung, which the server re-verifies fresh"],
      ["off", "set off", "shrbtn",
        "stores an explicit NO — refused like an absent record, but dated and readable as a decision"],
      ["revoke", "revoke", "shrbtn danger",
        "removes the record entirely, back to never-granted; revoking twice is an ordinary success"],
    ];
    for (const [act, label, cls, tip] of pmButtons) {
      const b = el("button", cls, qPmBusy && qPmAct === act ? `${label}…` : label) as HTMLButtonElement;
      b.disabled = qPmBusy;
      b.title = tip;
      b.onclick = () => { void pmRun(act); };
      pmActs.appendChild(b);
    }
    pm.appendChild(pmActs);
  }

  // THE PERMISSION TO BE STARTED, beside the permission to LAND — and they are two doors because
  // they are two questions. `promotion` answers "may this MAIN move the integration branch"; this
  // answers "may the fleet's tick spawn this program's released rows while the global queue is
  // stopped". Until this record existed the answer was one fleet-wide switch, and a Program-MAIN
  // that could file and release its own rows still needed a foreign hand to start them — the whole
  // reason it is here. It sits ABOVE the stale/unknown early return for the promotion door's
  // reason: a program whose MAIN died is exactly a program whose standing grant an owner may want
  // to take back, and that return would hide the only door that can.
  {
    if (qPdFor !== p.id) {
      qPdFor = p.id;
      qPdSeq++; // a DIFFERENT program; anything still in flight for the old one is orphaned
      qPdErr = null; qPdBusy = false; qPdAct = null;
    }
    const forPdId = p.id;
    const pdSt = programDispatchState(p);
    // THE FOUR BODIES, WRITTEN OUT as data rather than assembled from the button that was clicked —
    // the promotion door's construction, for its reason: a body built by concatenation is a body a
    // later edit can widen without anyone reading this pane again. The server reads a CLOSED set,
    // so every shape here is exactly {v, on, maxLanes} or null.
    // `maxLanes` on the OFF body is required by the door and inert by definition: an ungranted
    // record caps nothing. It is written as 1 so the stored row can never read as a budget.
    type PdAct = "on-1" | "on-2" | "off" | "revoke";
    const PD_BODY: Record<PdAct, { dispatch: { v: 1; on: boolean; maxLanes: number } | null }> = {
      "on-1": { dispatch: { v: 1, on: true, maxLanes: 1 } },
      "on-2": { dispatch: { v: 1, on: true, maxLanes: 2 } },
      off: { dispatch: { v: 1, on: false, maxLanes: 1 } },
      revoke: { dispatch: null },
    };
    const pdNoAnswer = (act: PdAct) =>
      `${act} did not reach the server — no answer came back, so whether this permission changed is unknown`;
    const pdRun = async (act: PdAct): Promise<void> => {
      const seq = ++qPdSeq;
      const mine = () => seq === qPdSeq && qPdFor === forPdId;
      qPdBusy = true; qPdErr = null; qPdAct = act;
      qDetailKey = ""; renderQueueDetail();
      let err: string | null = null;
      // moved-UNKNOWN, exactly as the three doors above count it: an unanswered request may well
      // have been applied, so the facts are re-read instead of the old state being repainted over a
      // permission that has in truth already changed.
      let moved = false;
      try {
        const r = await post(`/api/programs/${forPdId}/dispatch`, PD_BODY[act]).catch(() => null);
        if (!r) { err = pdNoAnswer(act); moved = true; }
        else if (r.ok) moved = true;
        else {
          const j = (await r.json().catch(() => null)) as { error?: string } | null;
          err = j?.error ? `${act} failed — ${r.status}: ${j.error}`
            : `${act} failed — the server answered ${r.status} with no readable reason`;
        }
      } finally {
        if (mine()) {
          qPdBusy = false; qPdAct = null;
          qPdErr = err;
          if (moved) await loadPrograms(true);
          qKey = ""; qDetailKey = "";
          renderQueue(); renderQueueDetail();
        } else if (moved) {
          await loadPrograms(true); qKey = ""; renderQueue();
        }
      }
    };

    const pd = qDetailSection(shell.detail, "Program dispatch");
    const pdFacts = el("div", "ocfacts");
    pdFacts.appendChild(chip(pdSt.label, pdSt.tone, pdSt.sentence));
    pdFacts.appendChild(chip(
      pdSt.stamped ? `decided ${pdSt.stamped}`
        : pdSt.state === "unreadable" ? "no readable dispatch stamp" : "never decided", "dim",
      pdSt.stamped ? "the server's own confirmedAt on this record — it stamps the act, no client clock is involved"
        : pdSt.state === "unreadable"
          ? "a record IS stored, but this build cannot read its stamp — an unreadable stamp is not a date"
          : "no record is stored at all, so there is no date to show"));
    pd.appendChild(pdFacts);
    pd.appendChild(el("div", "shellhint", pdSt.sentence));
    pd.appendChild(el("div", "shellhint",
      `POST /api/programs/${p.id}/dispatch — the owner-only door, and the only writer of this record.`
      + " It reaches ONE thing: whether the fleet tick may start this program's released rows while"
      + " the global dispatcher is stopped, and how many of its lanes may run at once. It does not"
      + " touch the autos kill-switch, and it can only lower the machine-wide per-program lane"
      + " budget. Each act below is sent on its own click, nothing is preselected, and every refusal"
      + " is the server's own sentence, word for word."));
    if (programsRead !== "ok") pd.appendChild(el("div", "pkdwarn",
      "the last GET /api/programs did not answer — the state above is CACHED context, not current"
      + " truth. The four acts below still reach the server and are safe to repeat."));
    if (qPdErr) pd.appendChild(el("div", "pkdwarn", qPdErr));
    const pdActs = el("div", "pkdacts");
    pdActs.style.marginTop = "10px";
    const pdButtons: [PdAct, string, string, string][] = [
      ["on-2", "grant · 2 lanes", "shrbtn primary",
        "the tick starts this program's released rows under a stopped fleet, at most two of its lanes at once"],
      ["on-1", "grant · 1 lane", "shrbtn",
        "the same grant, serialized to a single lane of this program — the cautious rung"],
      ["off", "set off", "shrbtn",
        "stores an explicit NO — refused like an absent record, but dated and readable as a decision"],
      ["revoke", "revoke", "shrbtn danger",
        "removes the record entirely, back to never-granted; revoking twice is an ordinary success"],
    ];
    for (const [act, label, cls, tip] of pdButtons) {
      const b = el("button", cls, qPdBusy && qPdAct === act ? `${label}…` : label) as HTMLButtonElement;
      b.disabled = qPdBusy;
      b.title = tip;
      b.onclick = () => { void pdRun(act); };
      pdActs.appendChild(b);
    }
    pd.appendChild(pdActs);
  }

  if (mark === "founding") {
    const founding = programFoundingState(p.founding);
    const pending = qDetailSection(shell.detail, "Program-MAIN founding recovery pending");
    if (founding.state === "pending") {
      const record = founding.record;
      const pendingFacts = el("div", "ocfacts");
      pendingFacts.appendChild(chip(`mode ${record.mode}`, "warn",
        "the durable marker's founding mode"));
      pendingFacts.appendChild(chip(`attempt ${record.attemptId}`, "dim",
        "the server-issued durable attempt id"));
      pendingFacts.appendChild(chip(`affected slot ${record.target.slot}`, "warn",
        `the durable marker names slot ${record.target.slot}, opened ${fmtTs(record.target.openedAt)}`));
      pending.appendChild(pendingFacts);
      pending.appendChild(el("div", "pkdwarn",
        `availability unknown; recovery pending. ${record.mode} attempt ${record.attemptId} affects slot`
          + ` ${record.target.slot} (opened ${fmtTs(record.target.openedAt)}). No bootstrap form is available`
          + " while this durable marker exists; a fresh GET /api/programs decides when recovery clears it."));
    } else {
      pending.appendChild(el("div", "pkdwarn",
        "the founding marker became unreadable while rendering — availability and recovery are unknown,"
          + " and bootstrap stays locked"));
    }
    if (qBsFor === p.id && qBsErr) pending.appendChild(el("div", "pkdwarn", qBsErr));
    return;
  }

  if (mark === "unknown") {
    const st = qDetailSection(shell.detail, "Binding");
    st.appendChild(el("div", "shellhint", programsRead === "fail"
        ? "No button here: the last GET /api/programs did not answer, so this row is cached context"
          + " and its binding is unknown. Founding resumes when a fresh read succeeds — an unknown"
          + " binding is not an absent one, and bootstrap-main would 409 on one that still stands."
        : "No button here: nothing can be founded while the binding cannot even be read. Fix the"
          + " missing fact first — an unknown binding is not an absent one."));
    return;
  }
  if (mark === "stale") {
    const st = qDetailSection(shell.detail, "Binding");
    st.appendChild(el("div", "shellhint",
      "The recorded MAIN occupant is gone. The founding form below may replace the stale binding;"
        + " the server rechecks that no live occupant still owns it before opening a new session and"
        + " names the replaced binding in its success response."));
  }
  // PROMOTION LIVED IN A TERMINAL. This pane could say "the server will answer 409 until it is
  // active" and nothing more, so the two owner transitions the server already gates were reachable
  // only through promote-program.sh. Both doors below are those exact routes with an EMPTY body:
  // confirm corrects nothing and re-validates the stored proposal, activate carries no body at all.
  if (p.status === "proposed" || p.status === "confirmed") {
    if (qPlFor !== p.id) {
      qPlFor = p.id;
      qPlSeq++; // a DIFFERENT program; anything still in flight for the old one is orphaned
      qPlErr = null; qPlBusy = false;
    }
    const forId = p.id;
    // One step, one sentence. The two 409s read alike ("illegal transition: cannot … a … program"),
    // so the step NAMES itself around the server's verbatim answer — a paraphrase would drop the
    // half that says which door closed.
    // A REQUEST THAT GOT NO ANSWER AT ALL is a third outcome, not a refusal: offline, a dropped
    // link, the server restarting under the click — the normal condition of a board read from a
    // phone. It has no status, so it invents none, and it is built here in ONE place so `run` can
    // recognise it again without parsing prose.
    const noAnswer = (action: "confirm" | "activate") =>
      `${action} did not reach the server — no answer came back, so whether it landed is unknown`;
    const step = async (action: "confirm" | "activate"): Promise<string | null> => {
      const r = await post(`/api/programs/${forId}/${action}`, {}).catch(() => null);
      if (!r) return noAnswer(action);
      if (r.ok) return null;
      const j = (await r.json().catch(() => null)) as { error?: string } | null;
      return j?.error ? `${action} failed — ${r.status}: ${j.error}`
        : `${action} failed — the server answered ${r.status} with no readable reason`;
    };
    const run = async (from: "proposed" | "confirmed"): Promise<void> => {
      const seq = ++qPlSeq;
      const mine = () => seq === qPlSeq && qPlFor === forId;
      qPlBusy = true; qPlErr = null;
      qDetailKey = ""; renderQueueDetail();
      let err: string | null = null;
      // `moved` is "the cached facts may be stale", not "a transition is proven": a step that got no
      // answer is moved-UNKNOWN, never moved-false. An unanswered request is not evidence that
      // nothing happened — the confirm may well be on the server — so the pane re-reads the facts
      // instead of repainting a guess over a program that has in truth already moved.
      let moved = false;
      try {
        if (from === "proposed") {
          err = await step("confirm");
          moved = err === null || err === noAnswer("confirm");
        }
        // A CONFIRM THAT LANDED IS KEPT. If activate then fails, the program IS confirmed: the facts
        // are re-read so the pane repaints with the activate door, and the ACTIVATE sentence is what
        // the owner reads. No rollback, and confirm is never re-issued as a repair.
        if (err === null) {
          err = await step("activate");
          moved = moved || err === null || err === noAnswer("activate");
        }
      } finally {
        // EVERY exit clears the busy flag — that is what a `finally` is for here, rather than each
        // branch remembering. The path that used to leave the door disabled on "promoting…" forever
        // was a request that never answered. `mine()` still fences the write: a busy flag set by a
        // NEWER run belongs to that run, and an orphan must not enable a button that is in flight.
        if (mine()) {
          qPlBusy = false;
          qPlErr = err;
          if (moved) await loadPrograms(true);
          qKey = ""; qDetailKey = "";
          renderQueue(); renderQueueDetail();
        } else if (moved) {
          // An orphaned answer still refreshes the FACTS — a transition that happened, happened —
          // but writes nothing into a draft that is no longer the one it was sent from.
          await loadPrograms(true); qKey = ""; renderQueue();
        }
      }
    };

    const pr = qDetailSection(shell.detail, "Promote");
    pr.appendChild(el("div", "shellhint", p.status === "proposed"
      ? `POST /api/programs/${p.id}/confirm, then /activate — the owner-only pair that turns a`
        + " proposal into a program Fleet will act on. Both are sent empty, so nothing here rewrites"
        + " the proposal; every refusal below is the server's own sentence, word for word."
      : `POST /api/programs/${p.id}/activate — this program is already confirmed, so only the second`
        + " transition is left. It is also the repair door after a confirm that landed while its"
        + " activate did not: the confirmed half stands, and only what failed is retried."));
    // WHAT THIS CLICK HANDS OVER, shown where the click is. A proposal may carry a WISH for the
    // self-land rung, and the confirm transition spends it: press the button below and the rung is
    // granted in the same act, with the server's own stamp. A permission that is invisible at the
    // moment it is granted is a permission granted by accident — so it is stated here, on the
    // PROPOSED row, rather than only afterwards in the promotion section where it would already be
    // in force. On a CONFIRMED row it is gone: the transition consumed it.
    if (p.status === "proposed") {
      const rq = promotionRequestState(p);
      const rqFacts = el("div", "ocfacts");
      rqFacts.appendChild(chip(rq.label, rq.tone, rq.sentence));
      pr.appendChild(rqFacts);
      pr.appendChild(el("div", rq.state === "unreadable" ? "pkdwarn" : "shellhint", rq.sentence));
    }
    if (qPlErr) pr.appendChild(el("div", "pkdwarn", qPlErr));
    const pacts = el("div", "pkdacts");
    pacts.style.marginTop = "10px";
    const promote = el("button", "shrbtn primary", p.status === "proposed"
      ? (qPlBusy ? "promoting…" : "confirm and activate")
      : (qPlBusy ? "activating…" : "activate")) as HTMLButtonElement;
    promote.disabled = qPlBusy;
    promote.title = p.status === "proposed"
      ? "runs both owner transitions in order; a confirm that succeeds is kept even if activate fails"
      : "the second transition on its own — the program is already confirmed";
    promote.onclick = () => { void run(p.status === "proposed" ? "proposed" : "confirmed"); };
    pacts.appendChild(promote);
    pr.appendChild(pacts);
  }

  if (mark === "live") return;

  const bs = qDetailSection(shell.detail, "Found a Program-MAIN");
  bs.appendChild(el("div", "shellhint",
    `POST /api/programs/${p.id}/bootstrap-main opens a free slot in the directory below and sends the`
    + " server-built founding brief. Fleet accepts it only for an ACTIVE program and only while a slot"
    + " is free; every refusal below is the server's own sentence, word for word."));
  if (p.status !== "active") bs.appendChild(el("div", "pkdwarn",
    `this program is ${p.status} — the server will answer 409 until it is active`));
  if (qBsFor !== p.id) {
    qBsFor = p.id;
    qBsSeq++; // this is a DIFFERENT draft; anything still in flight for the old one is orphaned
    qBsCwd = null; qBsLabel = null; qBsErr = null; qBsBusy = false;
    qBsHarness = null; qBsModel = ""; qBsEffort = "";
  }
  if (!qBsCwd) {
    qBsCwd = el("input", "qaddin") as HTMLInputElement;
    qBsCwd.placeholder = "cwd — the checkout this MAIN works in (required)";
    qBsCwd.title = "the server refuses a bootstrap without a cwd, and checks it before opening anything;"
      + " suggestions come from your pinned/recent projects";
    qBsCwd.setAttribute("list", "qrepodl");
    void ensureRepoDatalist();
  }
  bs.appendChild(qBsCwd);
  if (!qBsLabel) {
    qBsLabel = el("input", "qaddin") as HTMLInputElement;
    qBsLabel.placeholder = `label — empty = "Program-MAIN: ${p.title}"`;
    qBsLabel.title = "the slot label; leave it empty for the server's own";
  }
  bs.appendChild(qBsLabel);

  // the same three spawn fields every other spawn in this app carries, from the SAME server
  // catalogue — a harness that has no model or no effort concept simply does not offer the field
  const agents = agentHarnesses();
  if (agents.length > 1) {
    const row = el("div", "pkdopts");
    const hSel = el("select", "pkdsel") as HTMLSelectElement;
    for (const h of agents) {
      const o = el("option", "", h.default ? `${h.id} (default)` : h.id) as HTMLOptionElement;
      o.value = h.id;
      if ((qBsHarness ?? agents.find((x) => x.default)?.id) === h.id) o.selected = true;
      hSel.appendChild(o);
    }
    hSel.onchange = () => {
      const next = agents.find((h) => h.id === hSel.value);
      qBsHarness = next && !next.default ? next.id : null;
      if (!next?.supports.model) qBsModel = "";
      if (!next?.supports.effort || !next.effortLevels.includes(qBsEffort)) qBsEffort = "";
      qDetailKey = "";
      renderQueueDetail();
    };
    row.appendChild(labelled("harness", hSel));
    const chosen = agents.find((h) => h.id === hSel.value) ?? agents.find((h) => h.default);
    if (chosen?.supports.model) {
      const mIn = el("input", "pkdin") as HTMLInputElement;
      mIn.type = "text";
      mIn.placeholder = chosen.default && defaultModel ? defaultModel : "default";
      mIn.value = qBsModel;
      mIn.oninput = () => { qBsModel = mIn.value.trim(); };
      row.appendChild(labelled("model", mIn));
    }
    if (chosen?.supports.effort && chosen.effortLevels.length) {
      const eSel = el("select", "pkdsel") as HTMLSelectElement;
      for (const lv of ["", ...chosen.effortLevels]) {
        const o = el("option", "", lv || "default") as HTMLOptionElement;
        o.value = lv;
        if (qBsEffort === lv) o.selected = true;
        eSel.appendChild(o);
      }
      eSel.onchange = () => { qBsEffort = eSel.value; };
      row.appendChild(labelled("effort", eSel));
    }
    bs.appendChild(row);
  }

  if (qBsErr) bs.appendChild(el("div", "pkdwarn", qBsErr));
  const acts = el("div", "pkdacts");
  acts.style.marginTop = "10px";
  const go = el("button", "shrbtn primary", qBsBusy ? "founding…" : "found Program-MAIN") as HTMLButtonElement;
  go.disabled = qBsBusy;
  go.title = "opens a free slot in that cwd and sends the founding brief — this spawns a real session";
  go.onclick = async () => {
    const cwd = qBsCwd?.value.trim() ?? "";
    if (!cwd) {
      qBsErr = "cwd is required — the server refuses a bootstrap without one";
      qDetailKey = ""; renderQueueDetail();
      return;
    }
    const forId = p.id;
    const seq = ++qBsSeq;
    // still the same draft this send belongs to? Generation AND id, because either alone lies:
    // the generation catches A → B → A, the id catches a reset that did not bump anything.
    const mine = () => seq === qBsSeq && qBsFor === forId;
    qBsBusy = true; qBsErr = null;
    qDetailKey = ""; renderQueueDetail();
    const label = qBsLabel?.value.trim() ?? "";
    const r = await post(`/api/programs/${forId}/bootstrap-main`, {
      cwd,
      ...(label ? { label } : {}),
      ...(qBsHarness ? { harness: qBsHarness } : {}),
      ...(qBsModel ? { model: qBsModel } : {}),
      ...(qBsEffort ? { effort: qBsEffort } : {}),
    });
    const j = (await r.json().catch(() => null)) as unknown;
    const failure = r.ok ? null : bootstrapFailureMessage(r.status, j);
    // Every answer can change durable Program facts, including a typed 503: rolled-back may clear
    // the marker and become unbound, while pending must repaint from the marker and stay locked.
    await refresh();
    await loadPrograms(true);
    // An orphaned answer still refreshes the FACTS but writes nothing into a draft that is no
    // longer the one it was sent from.
    if (!mine()) {
      qKey = ""; renderQueue();
      return;
    }
    qBsBusy = false;
    if (failure !== null) {
      // The server sentence stays verbatim at the front. A typed 503 keeps the additive
      // availability/recovery/affected facts beside it instead of collapsing them into that prose.
      qBsErr = failure;
      qKey = ""; qDetailKey = "";
      renderQueue(); renderQueueDetail();
      return;
    }
    qBsErr = null;
    if (qBsCwd) qBsCwd.value = "";
    if (qBsLabel) qBsLabel.value = "";
    qKey = ""; qDetailKey = "";
    renderQueue(); renderQueueDetail();
  };
  acts.appendChild(go);
  bs.appendChild(acts);
}

// The lane line under a task row and at the top of its detail (qLaneJoins). `null` for a row
// with no pointer: nothing is drawn, because "no lane" on a pending row is not information. A
// `sent` row whose pointer was REFUSED does draw — that row claims to be running, and the line
// is where the owner sees that nothing attachable is.
function qLaneLine(join: QLaneJoin): HTMLElement | null {
  if (join.kind === "none") return null;
  if (join.kind === "refused") {
    const off = el("div", "shrsub qlane qlane-off", `slot ${join.slot} · no lane attached`);
    off.title = join.why;
    return off;
  }
  const l = join.lane;
  const facts = [l.state === "unknown" ? "state unknown" : l.state,
    l.dirty !== null && l.dirty > 0 ? `dirty ${l.dirty}` : "",
    l.quietMs !== null ? `quiet ${fmtDur(l.quietMs)}` : ""].filter(Boolean).join(" · ");
  const line = el("div", `shrsub qlane qlane-${l.state}`,
    `⎇ ${l.branch.replace(/^fleet\//, "")} · slot ${l.slot} · ${facts}`);
  line.title = [
    `branch ${l.branch} in slot ${l.slot}`,
    l.state === "unknown"
      ? (l.quietMs === null ? "no output observed yet — running/idle cannot be told"
        : "git facts not read yet — dirty/ahead unknown")
      : `${l.state}: quiet ${fmtDur(l.quietMs ?? 0)} (idle from ${Q_LANE_IDLE_MS / 60000} min), dirty ${l.dirty}, ahead ${l.ahead}`,
    l.state === "done-looking"
      ? "done-looking checks idle + clean tree + ahead>0 only — alive, git-op and merge state are not on this poll" : "",
    l.repo === "alias"
      ? "target repo and lane toplevel differ by a path prefix (alias) — this client cannot resolve symlinks, so the repo match is unproven"
      : "target repo matches the lane's toplevel",
    l.program === "unchecked" ? "program membership unchecked — the poll carries no programId per slot" : "",
  ].filter(Boolean).join("\n");
  return line;
}
// what a repaint key needs of the joins: everything the line PAINTS except the quiet time, whose
// minute already rides the list key — keying on the raw ms would rebuild the list on every poll
function qLaneKey(joins: ReadonlyMap<string, QLaneJoin>): unknown[] {
  return [...joins].map(([id, j]) => j.kind === "lane"
    ? [id, j.lane.slot, j.lane.branch, j.lane.state, j.lane.dirty, j.lane.ahead, j.lane.repo, j.lane.program]
    : j.kind === "refused" ? [id, j.slot, j.why] : null).filter(Boolean);
}
const qLaneJoinOf = (id: string): QLaneJoin =>
  qLaneJoins(tasksList, fleet, dispatch.repo, serverNow).get(id) ?? { kind: "none" };

function renderQueueDetail() {
  const shell = qShell;
  if (!shell) return;
  // A meaningful poll can repaint this pane while the owner is typing. The draft nodes themselves
  // survive below; restore focus and selection after moving them back into the new section tree.
  const focused = document.activeElement;
  const selection = focused instanceof HTMLTextAreaElement || focused instanceof HTMLInputElement
    ? { start: focused.selectionStart, end: focused.selectionEnd, direction: focused.selectionDirection }
    : null;
  const restoreFocus = () => {
    // a <select> has no text caret, but it does have focus worth keeping: the composer's program
    // picker is a kept node, so a repaint under an open keyboard interaction must not drop it
    if (!(focused instanceof HTMLTextAreaElement || focused instanceof HTMLInputElement
      || focused instanceof HTMLSelectElement) || !focused.isConnected) return;
    focused.focus();
    if (focused instanceof HTMLSelectElement) return; // no caret to restore, only the focus
    if (selection && selection.start !== null && selection.end !== null) {
      try { focused.setSelectionRange(selection.start, selection.end, selection.direction ?? undefined); }
      catch { /* input types without a text selection */ }
    }
  };
  shell.detail.replaceChildren();
  if (qPick === null) {
    if (qView !== "work") {
      const emptyDetail = qView === "programs"
        ? ["Programs", "Select a Program to inspect its binding, lifecycle and owner controls."]
        : qView === "history"
          ? ["History", "Select a done or archived task to inspect its record."]
          : ["Waves", "Select a projected task to inspect its evidence and actions."];
      shell.detail.appendChild(el("div", "rvhead", emptyDetail[0]));
      shell.detail.appendChild(el("div", "shellhint", emptyDetail[1]));
      restoreFocus();
      return;
    }
    shell.detail.appendChild(el("div", "rvhead", "New task"));
    shell.detail.appendChild(el("div", "shellhint",
      "Describe a feature or a fix. It lands as `pending` — only you move it to `queued`, and only"
      + " then can the dispatcher pick it up."));
    if (!qCompose) {
      qCompose = el("textarea", "qaddin") as HTMLTextAreaElement;
      qCompose.placeholder = "New task — describe a feature or fix…";
      qCompose.rows = 8;
    }
    shell.detail.appendChild(qCompose);
    if (!qRepoIn) {
      qRepoIn = el("input", "qaddin") as HTMLInputElement;
      // REQUIRED, and said so on the control itself. Empty was never "no repo": the server reads
      // an absent repo as the dispatch default, so the quiet path put tasks in the Fleet checkout
      // that were never meant for it. The button below refuses instead of posting.
      qRepoIn.placeholder = "target repo (path) — required";
      qRepoIn.title = "where this task's lane spawns; suggestions come from your pinned/recent projects";
      qRepoIn.setAttribute("list", "qrepodl");
      void ensureRepoDatalist();
    }
    shell.detail.appendChild(qRepoIn);
    shell.detail.appendChild(el("div", "shellhint", dispatch.repo
      ? `Target repo is required here. An empty value does not mean "no repo" — POST /api/tasks would`
        + ` silently fall back to ${dispatch.repo}.`
      : "Target repo is required here. An empty value does not mean \"no repo\" — the server would"
        + " silently fall back to its own dispatch default."));
    // programId is accepted by POST /api/tasks for a confirmed|active program ONLY, so this
    // dropdown offers exactly that set: a value it cannot offer is a 409 it cannot provoke.
    // And ONLY while a read stands: after a failed GET /api/programs the cached rows are context,
    // so nothing is offered at all — an emptied dropdown also drops any prior pick, which is the
    // fail-closed direction (no programId is sent rather than a stale one).
    const bindable = programsRead === "ok"
      ? programsList.filter((x) => x.status === "confirmed" || x.status === "active") : [];
    if (!qProgSel) {
      qProgSel = el("select", "pkdsel") as HTMLSelectElement;
      qProgSel.title = "bind this task to a program — optional, and only confirmed or active programs qualify";
    }
    const keepProg = qProgSel.value;
    qProgSel.replaceChildren();
    const noProg = el("option", "", "— no program —") as HTMLOptionElement;
    noProg.value = "";
    qProgSel.appendChild(noProg);
    for (const x of bindable) {
      const o = el("option", "", `${x.title} (${x.status})`) as HTMLOptionElement;
      o.value = x.id;
      qProgSel.appendChild(o);
    }
    qProgSel.value = bindable.some((x) => x.id === keepProg) ? keepProg : "";
    shell.detail.appendChild(labelled("program", qProgSel));
    if (!bindable.length) shell.detail.appendChild(el("div", "shellhint",
      programsRead === "fail" ? "GET /api/programs did not answer — no program is offered here until a"
        + " fresh read succeeds; the cached rows in the list are context, not a current binding claim"
        : programsRead === "unread" ? "programs have not been read yet"
        : "no confirmed or active program exists — a task can only bind to one of those"));
    const add = el("button", "shrbtn primary", "add task") as HTMLButtonElement;
    add.onclick = async () => {
      const box = qCompose;
      if (!box || !box.value.trim()) return;
      const repo = qRepoIn?.value.trim() ?? "";
      if (!repo) {
        toast(dispatch.repo
          ? `target repo is required — an empty value would silently become ${dispatch.repo}`
          : "target repo is required — an empty value would silently become the server's dispatch default");
        return;
      }
      const programId = qProgSel?.value ?? "";
      const r = await post("/api/tasks", { text: box.value, queue: false, repo,
        ...(programId ? { programId } : {}) });
      if (!r.ok) {
        // a bad repo path comes back with the exact reason — show it, keep the typed text
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        toast(j?.error ?? "couldn't add the task");
        return;
      }
      box.value = ""; // the repo input stays — several tasks for one project is the common flow
      await refresh();
      qKey = "";
      renderQueue();
    };
    const acts = el("div", "pkdacts");
    acts.style.marginTop = "10px";
    acts.appendChild(add);
    shell.detail.appendChild(acts);
    restoreFocus();
    return;
  }
  // program rows carry a prefixed id; a task id is plain hex and can never collide with it
  if (qPick.startsWith("prog:")) {
    renderProgramDetail(shell, qPick.slice(5));
    restoreFocus();
    return;
  }
  const t = tasksList.find((x) => x.id === qPick);
  if (!t) {
    shell.detail.appendChild(el("div", "shellhint", "that task is gone — it was completed or deleted"));
    restoreFocus();
    return;
  }
  const brief = taskBriefFull.get(t.id);
  const crit = taskCriterionFull.get(t.id) ?? t.criterion;
  const ref = taskRefineFull.get(t.id);
  // --- DETAIL HEAD (paint): the plan from qHeadPlan, painted ABOVE every section — status,
  // program, target repo, the lifecycle rail, and the ONE main action with the single line that
  // says what it does. Nothing else may be appended between here and the first section: the whole
  // point is that the next decision is readable without scrolling at 1440×900.
  const laneJoin = qLaneJoinOf(t.id);
  const head = qHeadPlan({
    status: t.status, kind: t.kind, slot: t.slot, repo: t.repo, programId: t.programId,
  }, programsList.find((x) => x.id === t.programId)?.title ?? null,
  laneJoin.kind === "lane" ? { kind: "lane", slot: laneJoin.lane.slot } : { kind: laneJoin.kind });
  shell.detail.appendChild(el("div", "rvhead qdhead-status", head.status));
  const headFacts = el("div", "ocfacts qdhead-facts");
  headFacts.appendChild(chip(head.program, "dim", t.programId
    ? `this row is bound to program ${t.programId}`
    : "this row belongs to no program — it is loose queue work"));
  headFacts.appendChild(chip(head.repo, "dim", t.repo
    ? `target repo: ${t.repo} — this task's lane spawns there`
    : "this row names no target repo — a dispatch would fall back to the server's default"));
  shell.detail.appendChild(headFacts);
  // THE LIFECYCLE RAIL. Four stations plus, when the row is off them, the end it is in. Only
  // facts from this poll: a station is `on`, an earlier one `past`, everything else plain — and an
  // archived row marks NO station, because the poll does not carry the walk it once made.
  const life = el("div", "qlife");
  life.title = "pending → queued → sent → landed/done, as this poll reads it."
    + " archived and advisory are ends of their own, not stations on that rail";
  head.life.stations.forEach((station, i) => {
    const on = head.life.current === station;
    const past = head.life.reached > i && !on;
    life.appendChild(el("span", `qlife-st${on ? " on" : past ? " past" : ""}`,
      station === "done" ? "landed/done" : station));
  });
  if (head.life.current === "archived" || head.life.current === "advisory"
    || head.life.current === "unknown")
    life.appendChild(el("span", "qlife-st end on", head.life.current));
  shell.detail.appendChild(life);
  // the one action's own row. Filled from the act placement below (`place`), so the button that
  // lands here is the very same node, with the very same handler, that Actions would have held.
  const mainBox = el("div", "qdmain");
  shell.detail.appendChild(mainBox);
  shell.detail.appendChild(el("div", "qdmain-why", head.main.why));
  // ACTIONS FIRST, discussion after: the request text and the comment thread used to sit between
  // the head and the acts, which is exactly how the decision ended up below the fold.
  const actionSection = qDetailSection(shell.detail, "Actions");
  const overview = qDetailSection(shell.detail, "Overview & discussion");
  const hasRefinement = (!qAdvisory(t) && (t.status === "pending" || t.status === "queued"))
    || brief !== undefined || crit !== undefined || ref !== undefined;
  const refinement = hasRefinement ? qDetailSection(shell.detail, "Refinement") : null;
  // Once a compiled brief exists, the original request is supporting evidence rather than the
  // primary working text. Keep it one click away; raw tasks stay open because it is all they have.
  const request = qDetailSection(shell.detail, "Request", true, brief === undefined);
  // EVIDENCE: the lane this row is running in, or why none attaches (a `sent` row with nothing
  // attached is the state the owner must be able to read). Verify facts are NOT on the owner
  // poll, and the section says that rather than leaving the absence to be read as a green run.
  const evidence = qDetailSection(shell.detail, "Evidence — lane & verify facts");
  const laneLine = qLaneLine(laneJoin);
  if (laneLine) {
    evidence.appendChild(laneLine);
    if (laneJoin.kind === "refused") evidence.appendChild(el("div", "shellhint", laneJoin.why));
  } else {
    evidence.appendChild(el("div", "shellhint", "no lane pointer on this row"));
  }
  evidence.appendChild(el("div", "shellhint",
    "verify and land facts are not on this poll — unknown here, not green"));
  // DANGER ZONE: the one irreversible act on this pane, folded and last, so it is never a
  // neighbour of the main action above.
  const danger = qDetailSection(shell.detail, "Danger zone", true, false);
  const meta = el("div", "ocfacts");
  meta.appendChild(chip(taskSourceLabel(t)));
  if (qAdvisory(t)) meta.appendChild(chip(`${t.kind} — not work`, "dim",
    "an advisory row does not assign work. Change its Kind to auftrag to enter the normal workflow"));
  if (t.refining) meta.appendChild(chip("↻ refining…", "dim",
    "the brief compiler is reading the repo — this can take a few minutes; the proposal appears here when it lands"));
  if (t.repo) meta.appendChild(chip(`⌂ ${t.repo.split("/").pop() || t.repo}`, "dim",
    `target repo: ${t.repo} — this task's lane spawns there`));
  meta.appendChild(chip(fmtTs(t.created), "dim", "when this task was created"));
  if (t.note) meta.appendChild(chip(t.note, "warn"));
  overview.appendChild(meta);
  // File and cluster provenance belongs in the selected detail, never as a fifth row fact. Missing
  // files is said as UNKNOWN because an absent surface is exactly what Waves must keep outside.
  overview.appendChild(el("div", "rvhead", "file surface & cluster"));
  // "by refinement" until 2026-09-07, when it stopped being true: the refine promote is no longer
  // the only writer of a confirmed surface, and naming the wrong door would send a reader looking
  // for a split that never happened. WHO confirmed it is in audit.jsonl, which is where a
  // provenance question belongs.
  const origin = t.filesOrigin === "confirmed" ? "confirmed by the owner"
    : t.filesOrigin === "card" ? "lifted from the row's card"
      : t.filesOrigin === "derived" ? "mechanically derived" : "origin unavailable";
  // THE ORIGIN AS ITS OWN CHIP (2026-09-13): "card" sits between the other two and bundles by a
  // different rule than either, so it is named where the eye lands rather than inside the sentence.
  if (t.files?.length && t.filesOrigin) overview.appendChild(chip(t.filesOrigin,
    t.filesOrigin === "confirmed" ? "ok" : t.filesOrigin === "card" ? "" : "dim",
    t.filesOrigin === "confirmed" ? "confirmed surface — bundles on a shared file or on nearby ranges"
      : t.filesOrigin === "card" ? "card surface, lifted without a confirming act — bundles only where both rows"
        + " name nearby ranges (FLEET_CARD_AUTOLIFT); confirming it below makes it a confirmed surface"
        : "derived from prose — never bundled until confirmed"));
  overview.appendChild(el("div", "shellhint", t.files?.length
    ? `known files · ${origin}: ${t.files.join(", ")}`
    : "file surface unknown — absence is not an empty surface"));
  // The PROPOSED surface, drawn UNDER the standing one and never merged into it: holding those two
  // lines against each other is exactly the act the button below ends, so a rendering that showed
  // only the winner would remove the reason to click. Only the owner sees this button — the propose
  // door is a self route, and there is no self mirror of the confirm.
  const fprop = t.filesProposal;
  if (fprop) {
    overview.appendChild(el("div", "shellhint",
      `proposed · ${fprop.by || "unknown"} (${fmtTs(fprop.at)}): ${fprop.files.join(", ")}`));
    // two severities, two colours, never merged — the same distinction the refine validation draws
    // one section below: "this repo does not track it" is a measured finding, "the tree could not
    // be read" is an absent measurement, and only the first is evidence against the proposal.
    if (fprop.unknownPaths === undefined)
      overview.appendChild(el("div", "qdfind unk",
        "? the target repo's tracked tree could not be read — not measured is not a pass"));
    else if (fprop.unknownPaths.length)
      overview.appendChild(el("div", "qdfind err",
        `✕ not tracked in the target repo: ${fprop.unknownPaths.join(", ")}`));
    const facts = el("div", "pkdacts");
    // the button follows the route's own two statuses: a surface is confirmed while the row is
    // still open, and an advisory kind carries none at all
    if (t.kind === "auftrag" && (t.status === "pending" || t.status === "queued")) {
      const cb = el("button", "shrbtn primary", "✓ confirm this file surface") as HTMLButtonElement;
      cb.title = "writes these paths onto THIS row as its confirmed surface — no children, no archive."
        + " Only a confirmed surface may be bundled into a land wave";
      cb.onclick = () => void qAct(t.id, "files", {});
      facts.appendChild(cb);
    }
    const fdb = el("button", "shrbtn", "✕ discard proposal") as HTMLButtonElement;
    fdb.title = "drops the proposed surface — the row's own surface is untouched either way";
    fdb.onclick = () => void qAct(t.id, "files", { accept: false });
    facts.appendChild(fdb);
    overview.appendChild(facts);
  } else if ((t.filesOrigin === "derived" || t.filesOrigin === "card") && t.files?.length
    && t.kind === "auftrag" && (t.status === "pending" || t.status === "queued")) {
    // --- DERIVED SURFACE REVIEW (the manual half of S2). Without a parked proposal the row still
    // HAS a list — the mechanically derived one — and until 2026-09-12 the only way to confirm it
    // was to retype it. Measured that day over 42 open auftrag rows: 42 waves of one, 0 confirmed,
    // while the derived list carried COMMAND MENTIONS as paths (17 rows named `e2e-isolated.sh`,
    // 18 `e2e/pins.ts`, mostly because the brief quoted the verify line). So the list is offered
    // per path and every path is DESELECTABLE: confirming it whole would christen those mentions
    // as facts. Nothing here confirms by itself — the button is the owner's act, and it sends
    // exactly the boxes that are still ticked, read off the DOM at click time so "the paths shown"
    // and "the paths sent" cannot drift apart.
    const picks: { path: string; box: HTMLInputElement }[] = [];
    overview.appendChild(el("div", "shellhint",
      "nothing below is confirmed. Untick what the row does not actually touch — a path the brief"
      + " merely QUOTED (a verify command, a doc reference) is the common false positive — then confirm."));
    for (const path of t.files) {
      const row = el("label", "qrawack");
      const box = el("input", "") as HTMLInputElement;
      box.type = "checkbox";
      box.checked = true;
      row.appendChild(box);
      row.appendChild(el("span", "", path));
      picks.push({ path, box });
      overview.appendChild(row);
    }
    const dacts = el("div", "pkdacts");
    const db = el("button", "shrbtn primary", "✓ confirm the ticked paths") as HTMLButtonElement;
    db.title = "writes the ticked paths onto THIS row as its confirmed surface — no children, no"
      + " archive. Only a confirmed surface may be bundled into a land wave";
    db.onclick = () => {
      const files = picks.filter((p) => p.box.checked).map((p) => p.path);
      // an empty selection is NOT an empty surface: the route would answer 400 and the row would
      // keep its derived list either way, so the click is answered here and no request is sent.
      if (!files.length) { toast(`no path is ticked — nothing was sent; this row keeps its ${t.filesOrigin} surface`); return; }
      void qAct(t.id, "files", { files });
    };
    dacts.appendChild(db);
    overview.appendChild(dacts);
    // --- end DERIVED SURFACE REVIEW ---
  }
  if (t.cluster) overview.appendChild(el("div", "shellhint",
    `cluster projection: ${[t.cluster.projekt, t.cluster.prozess, t.cluster.unterprozess].filter(Boolean).join(" / ")}`));
  else overview.appendChild(el("div", "shellhint", "cluster projection unavailable"));
  if (qView === "waves") {
    const location = qWaveLocation(t.id, qWaveProjection());
    if (location?.kind === "wave") overview.appendChild(el("div", "shellhint",
      `Waves: Wave ${location.wave} in ${baseName(location.repo)} — no known file intersection.`));
    else if (location?.kind === "unresolved") {
      const why = location.item.reason === "unknown-files" ? "file surface unknown"
        : location.item.reason === "unknown-repo" ? "target repo unknown" : "lane capacity is zero";
      overview.appendChild(el("div", "shellhint", `Waves: outside — ${why}.`));
    }
  }
  // N3 · SOURCES / VERDICTS — above the comments, because an assignment is an INSTRUCTION and a
  // comment is a remark: the section that decides what a lane will be handed belongs over the one
  // that decides how it should feel about it. Only one of the two ever shows on a row — an auftrag
  // NAMES sources, a notiz IS one and carries the reports given under each task.
  if (t.kind === "auftrag" || (t.notes?.n ?? 0) > 0) {
    const pins = taskNotesFull.get(t.id) ?? [];
    const rows = qNoteSourceRows(pins, tasksList, taskText);
    overview.appendChild(el("div", "rvhead", rows.length ? `Quellen · ${rows.length}` : "Quellen"));
    if (rows.length === 0) overview.appendChild(el("div", "shellhint",
      "keine — diese Zeile bekommt Notizen nur ueber die Datei-Flaeche, als Hinweis, nicht als Auftrag"));
    for (const row of rows) {
      overview.appendChild(el("div", "qdtext", `${row.noteId} — ${row.text}`));
      const line = el("div", "pkdacts");
      // "unknown" is rendered as itself. A pinned id the queue no longer answers is not an empty
      // assignment: the lane's own brief will report it the same way, and hiding it here would
      // make the two surfaces disagree about the one fact this section exists to show.
      line.appendChild(el("div", "shellhint", row.known
        ? `${row.status} · angeheftet von ${row.by}`
        : "unbekannt — keine Queue-Zeile traegt diese Id mehr"));
      const rx = el("button", "shrbtn", "\u2715") as HTMLButtonElement;
      rx.title = "detach this source — the note keeps its row, its text and every verdict already given under this task";
      rx.onclick = () => void qAct(t.id, "notes", { note: row.noteId, attach: false });
      line.appendChild(rx);
      overview.appendChild(line);
    }
    if (t.status === "pending" || t.status === "queued") {
      const abox = el("input", "qdcrit") as HTMLInputElement;
      abox.placeholder = "notiz-Id anheften…";
      const aacts = el("div", "pkdacts");
      const ab = el("button", "shrbtn", "\ud83d\udcce anheften") as HTMLButtonElement;
      ab.title = "assign a notiz as a SOURCE of this task: its full text reaches the lane, and the lane"
        + " reports on it per task — an `erledigt` closes the note only when THIS row lands";
      ab.onclick = () => {
        const id = abox.value.trim();
        if (!id) return;
        void qAct(t.id, "notes", { note: id, attach: true }).then((ok) => { if (ok) abox.value = ""; });
      };
      aacts.appendChild(ab);
      overview.appendChild(abox);
      overview.appendChild(aacts);
    } else overview.appendChild(el("div", "shellhint",
      `die Zuordnung ist eingefroren: ein Land-Brief ist aus ihr gebaut worden (${t.status})`));
  }
  if (t.kind === "notiz") {
    const vs = qNoteVerdictRows(taskVerdictsFull.get(t.id) ?? [], tasksList);
    overview.appendChild(el("div", "rvhead", vs.length ? `Urteile je Aufgabe · ${vs.length}` : "Urteile je Aufgabe"));
    if (vs.length === 0) overview.appendChild(el("div", "shellhint",
      "keins — diese Notiz wurde noch unter keiner Aufgabe beurteilt"));
    for (const v of vs) {
      overview.appendChild(el("div", "qdtext", v.text));
      // WHICH ROW'S LAND makes it wirksam, named in full: a task-scoped `erledigt` closes this note
      // at the land of THAT row and of no other, which is exactly the sentence a reader needs in
      // order not to read it as the old global claim.
      overview.appendChild(el("div", "pkdacts", `${v.verdict} · ${v.branch} · zu ${v.taskId}`
        + (v.taskKnown ? "" : " (Zeile nicht mehr auf der Queue)")
        + (v.verdict === "erledigt"
          ? v.settled
            ? ` — diese VERWENDUNG ist mit dem Land ${(v.landedSha ?? "").slice(0, 7) || "?"} erledigt; die Notiz selbst bleibt deine Entscheidung`
            : " — wird mit dem Land GENAU DIESER Zeile wirksam, und dann nur fuer sie"
          : "")
        + ` · ${fmtTs(v.at)}`));
    }
  }
  // COMMENTS — sits directly under the chips, because it is the only text on
  // this row a HUMAN wrote and the one most likely to overrule everything below it. Always
  // present, even empty: "there was nowhere to leave a remark" is the defect this closes, and a
  // box that appears only once a thread exists has the same problem one click deeper.
  const cms = taskCommentsFull.get(t.id) ?? [];
  overview.appendChild(el("div", "rvhead", cms.length ? `comments · ${cms.length}` : "comments"));
  for (const c of cms) {
    overview.appendChild(el("div", "qdtext", c.text));
    const cline = el("div", "pkdacts");
    // WHO said it and WHAT they claimed, beside the timestamp. Only `erledigt` ever moves this row,
    // and only when the branch that wrote it lands — said here rather than left to be inferred,
    // because a `widerlegt` sitting under a still-pending note otherwise reads as an ignored report.
    if (c.verdict) cline.appendChild(el("div", "shellhint",
      `${c.verdict} · ${c.from ?? "lane"}${c.verdict === "erledigt" ? " — closes this note when that branch lands" : ""}`));
    cline.appendChild(el("div", "shellhint", fmtTs(c.ts)));
    const cx = el("button", "shrbtn", "✕") as HTMLButtonElement;
    cx.title = "delete this comment";
    cx.onclick = () => void qAct(t.id, "comment-delete", { comment: c.id });
    cline.appendChild(cx);
    overview.appendChild(cline);
  }
  // the box itself is kept across rebuilds (see qCmBox): the 2 s poll repaints this pane whenever
  // a verdict or a comment lands, and a locally-created textarea would lose a half-typed remark
  if (!qCmBox || qCmFor !== t.id) {
    qCmBox = el("textarea", "qdcrit") as HTMLTextAreaElement;
    qCmBox.rows = 3;
    qCmBox.placeholder = "leave a comment on this task…";
    qCmFor = t.id;
  }
  const cbox = qCmBox;
  overview.appendChild(cbox);
  const cmacts = el("div", "pkdacts");
  const cmb = el("button", "shrbtn", "💬 comment") as HTMLButtonElement;
  cmb.title = "a remark for whoever picks this up — read, never executed:"
    + " it is not appended to the brief the lane receives";
  cmb.onclick = () => {
    if (!cbox.value.trim()) return;
    // cleared only once the server has it — a draft dropped on a failed post is gone for good
    void qAct(t.id, "comment", { text: cbox.value }).then((ok) => { if (ok) cbox.value = ""; });
  };
  cmacts.appendChild(cmb);
  overview.appendChild(cmacts);
  // THE BRIEF — the exact bytes a lane receives, editable while the task has not been sent.
  // It exists in the UI at all because it used to be compiled at spawn time and fired straight
  // into the pane: unreadable before the fact, and a different string from the one that had been
  // approved. Editing pins it — the sweep never recompiles over an edit.
  if (!qAdvisory(t) && (t.status === "pending" || t.status === "queued")) {
    refinement!.appendChild(el("div", "rvhead",
      brief ? `the brief this lane will receive${brief.edited
        ? (briefByMain(brief) ? ` · sharpened by its Program-MAIN ${fmtTs(brief.at)}` : " · yours")
        : ` · compiled ${fmtTs(brief.at)}`}`
        : "no compiled brief yet — the lane would receive your raw text"));
    qBriefDraft = qTextDraft(qBriefDraft, t.id, brief?.text ?? qTaskText(t.id), 10);
    const bbox = qBriefDraft.box;
    refinement!.appendChild(bbox);
    const bacts = el("div", "pkdacts");
    const bb = el("button", "shrbtn", "save brief") as HTMLButtonElement;
    bb.title = "pins this text as the brief — nothing recompiles over it";
    bb.onclick = () => void qAct(t.id, "brief", { text: bbox.value }).then((ok) => {
      if (ok && qBriefDraft?.for === t.id) {
        qBriefDraft.seed = bbox.value;
        qBriefDraft.dirty = false;
      }
    });
    bacts.appendChild(bb);
    refinement!.appendChild(bacts);
  } else if (brief) {
    refinement!.appendChild(el("div", "rvhead", "the brief this lane received"));
    refinement!.appendChild(el("div", "qdtext", brief.text));
  }
  // the done-criterion: a clarify lane's proposal until you confirm it. Editable in place —
  // confirming stores what YOU agreed to, which is what makes it your anchor and not its own
  if (crit) {
    // narrowed through a local, not a boolean-plus-`!`: the assertion form would hand fmtTs a
    // null as "Jan 1 1970" the day a third criterion state decouples the two lines
    const confirmedAt = crit.confirmedAt;
    const confirmed = confirmedAt !== null;
    refinement!.appendChild(el("div", "rvhead",
      confirmedAt !== null ? `done-criterion · confirmed ${fmtTs(confirmedAt)}` : "done-criterion · PROPOSED — yours to confirm"));
    if (confirmed) {
      refinement!.appendChild(el("div", "qdtext", crit.text ?? ""));
    } else {
      qCriterionDraft = qTextDraft(qCriterionDraft, t.id, crit.text ?? "", 6);
      const box = qCriterionDraft.box;
      refinement!.appendChild(box);
      const cacts = el("div", "pkdacts");
      const cb = el("button", "shrbtn primary", "✓ confirm criterion") as HTMLButtonElement;
      cb.title = "makes this criterion yours and releases the lane to build against it";
      cb.onclick = () => void qAct(t.id, "criterion-confirm", { text: box.value }).then((ok) => {
        if (ok && qCriterionDraft?.for === t.id) {
          qCriterionDraft.seed = box.value;
          qCriterionDraft.dirty = false;
        }
      });
      cacts.appendChild(cb);
      refinement!.appendChild(cacts);
    }
  }
  // the draft, wrapped and selectable — the row only ever shows its first line. Labelled once a
  // brief exists, because then these are two different texts and confusing them is the whole
  // defect this panel was built to end.
  const body = qTaskText(t.id);
  if (brief) request.appendChild(el("div", "rvhead", "your draft, as filed"));
  request.appendChild(el("div", body ? "qdtext" : "shellhint",
    body || "loading the prompt text…"));
  // ↻ the refine proposal. Rendered BELOW the original text on purpose: the two are meant to be
  // read against each other, and what the owner promotes is the compiled version — so the thing
  // being replaced stays visible right above it until they decide.
  if (ref) {
    const kids = ref.proposal.tasks ?? [];
    refinement!.appendChild(el("div", "rvhead",
      ref.proposal.unchanged ? `refine · already brief-shaped (${fmtTs(ref.at)})`
        : `refine · PROPOSED ${kids.length === 1 ? "rewrite" : `split into ${kids.length}`} — yours to apply (${fmtTs(ref.at)})`));
    if (ref.proposal.unchanged) {
      refinement!.appendChild(el("div", "qdtext",
        `${ref.proposal.reason || "already brief-shaped"} (${ref.model})`));
    } else {
      kids.forEach((c, i) => {
        refinement!.appendChild(el("div", "qdtext", [
          `${kids.length > 1 ? `${i + 1}. ` : ""}${c.text}`,
          ...(c.files?.length ? [`Files: ${c.files.join(", ")}`] : []),
          ...(c.doneCriterion ? [`Done: ${c.doneCriterion}`] : []),
          ...(c.verify ? [`Verify: ${c.verify}`] : []),
        ].join("\n")));
        // …and the machine's own reading of that child, immediately under it. Two severities, two
        // colours, never merged: "not tracked in this repo" is a measured defect, "could not be
        // read" is an absent measurement, and only the first is evidence of a bad proposal.
        for (const sev of ["error", "unknown"] as const) {
          const mine = (ref.validation?.findings ?? []).filter((f) => f.child === i && f.severity === sev);
          if (mine.length) refinement!.appendChild(el("div", `qdfind ${sev === "error" ? "err" : "unk"}`,
            mine.map((f) => `${sev === "error" ? "✕" : "?"} ${f.detail}`).join("\n")));
        }
      });
      // and the verdict once, above the buttons — so the apply click is never the first place the
      // owner could have learned it. It says what it is (a check, not a gate) because the button
      // beneath it stays enabled either way: promoting a flagged proposal is the owner's to do.
      if (ref.validation && ref.validation.verdict !== "pass")
        refinement!.appendChild(el("div", `qdfind ${ref.validation.verdict === "fail" ? "err" : "unk"}`,
          ref.validation.verdict === "fail"
            ? `checked against the target repo: ${ref.validation.findings.filter((f) => f.severity === "error").length} finding(s) above. Applying anyway is yours to decide.`
            : "checked against the target repo: some of it could not be checked (see above) — not measured is not a pass."));
    }
    const racts = el("div", "pkdacts");
    // applying is all-or-nothing and archives this row — say so on the button, because the
    // alternative reading ("adds the children alongside") is the one that would surprise
    if (!ref.proposal.unchanged && (t.status === "pending" || t.status === "queued")) {
      const ab = el("button", "shrbtn primary",
        `✓ apply — replace this task with ${kids.length === 1 ? "it" : `these ${kids.length}`}`) as HTMLButtonElement;
      ab.title = "creates the compiled task(s) as new pending rows and archives this one";
      ab.onclick = () => void qAct(t.id, "refine-confirm", {});
      racts.appendChild(ab);
    }
    const db = el("button", "shrbtn", "✕ discard proposal") as HTMLButtonElement;
    db.title = "drops the proposal — the task itself is untouched either way";
    db.onclick = () => void qAct(t.id, "refine-confirm", { accept: false });
    racts.appendChild(db);
    refinement!.appendChild(racts);
  }
  const acts = el("div", "pkdacts");
  const mk = (label: string, action: string, cls = "shrbtn", body?: Record<string, unknown>, title?: string) => {
    const b = el("button", cls, label) as HTMLButtonElement;
    if (title) b.title = title;
    b.onclick = () => void qAct(t.id, action, body ?? {});
    return b;
  };
  // WHERE AN ACT LANDS. The head hosts exactly the one act qMainActionOf named for this status;
  // every other act stays here. The node is built once either way — same label rules, same
  // handler, same body — so the head is a placement, never a second copy of a door.
  const isMain = (act: QMainAct): boolean => head.main.act === act;
  const place = (node: HTMLElement, act: QMainAct): void => { (isMain(act) ? mainBox : acts).appendChild(node); };
  const mainCls = (act: QMainAct): string => isMain(act) ? "shrbtn primary" : "shrbtn";
  const kindRow = el("label", "qkind");
  kindRow.appendChild(el("span", "qkind-label", "Kind"));
  const kindSelect = el("select", "qkind-select") as HTMLSelectElement;
  const currentKind = t.kind ?? "auftrag";
  for (const kind of ["auftrag", "richtung", "notiz", "betrieb"] as const) {
    const option = document.createElement("option");
    option.value = kind;
    option.textContent = kind;
    option.selected = kind === currentKind;
    kindSelect.appendChild(option);
  }
  kindSelect.title = "changes only the task category — switching to auftrag does not release it";
  kindSelect.onchange = () => {
    const kind = kindSelect.value as NonNullable<TaskInfo["kind"]>;
    if (kind === currentKind) return;
    kindSelect.disabled = true;
    void qAct(t.id, "kind", { kind }).then((ok) => {
      if (!ok) {
        kindSelect.value = currentKind;
        kindSelect.disabled = false;
      }
    });
  };
  kindRow.appendChild(kindSelect);
  actionSection.appendChild(kindRow);

  // AN ADVISORY ROW stays non-dispatchable, but it is no longer a cul-de-sac: the four-kind
  // selector above can turn richtung, notiz or betrieb into an auftrag. The successful refresh
  // then reaches the normal branch below; changing category never releases the row.
  // `adopt` remains the deliberately narrow compatibility alias for pending notiz→auftrag.
  if (qAdvisory(t)) {
    if (t.status === "pending" && t.kind === "notiz")
      place(mk(isMain("adopt") ? head.main.label ?? "→ adopt as a task" : "→ adopt as a task",
        "adopt", mainCls("adopt"),
        {}, "turns this observation into a work brief — it gets analysed, and you still release it"), "adopt");
  } else {
    // "▸ start lane" spawns the lane NOW — independent of the auto dispatcher, which may be off
    const startable = t.status === "pending" || t.status === "queued";
    // A RAW START is one where the lane receives the owner's DRAFT rather than a compiled or
    // owner-written brief. The route gates on none of it by design (server.ts, taskDispatch) —
    // which is exactly what made this click indistinguishable from starting a row somebody had
    // sharpened: same blue button, same single gesture, same audit line. So a raw start SAYS what
    // it is starting, drops out of the primary style, and stays disabled until the line under it is
    // ticked. Not a ban — a second, deliberate gesture — and the two paths that FIX the state
    // (clarify, refine) stay in the same row, readable while you decide.
    //
    // Until 2026-09-10 "raw" meant "the queue analyst did not say ready". The analyst is retired,
    // so this is re-grounded on the fact that outlived it — WHICH BYTES the lane gets — rather than
    // left standing as a flag that would now be true of every row and therefore say nothing.
    // WHAT the lane would start AS, before either act below: the harness/model/effort pickers, the
    // effective triple with its origins, and the server's refusal if the combination cannot run.
    // Both acts read the same pick (qSpawnPick) at click time and stay disabled while it is blocked.
    const spawnProblem = startable ? qSpawnStateOf(t.id).problem : null;
    if (startable) acts.appendChild(qSpawnRow(t.id));
    if (startable) {
      const raw = !brief;
      // the same state twice, in the two places it has to be legible: on the button as a label, and
      // on the acknowledgment as the CONSEQUENCE — what the lane gets
      const rawWhat = "raw request";
      const rawWhy = crit?.confirmedAt
        ? "start it raw — the lane gets your draft as it stands, with the confirmed criterion beside it"
        : "start it raw — the lane gets your draft as it stands, and nothing says what done means";
      // ▸ START: the body is built at CLICK time from the row's pick (qDispatchBody "start") — the
      // picked triple, plus the acknowledgment only when the row is raw. Nothing else rides along.
      // the head calls this act "▸ start by hand" (a released row the owner starts now); in the
      // Actions row it keeps its own name. The raw suffix rides on both.
      const startName = isMain("start") ? head.main.label ?? "▸ start lane" : "▸ start lane";
      const sb = el("button", raw ? "shrbtn qraw" : mainCls("start"),
        raw ? `${startName} — ${rawWhat}` : startName) as HTMLButtonElement;
      sb.title = spawnProblem ? `blocked: ${spawnProblem}`
        : raw ? "a raw start — tick the line below to confirm it; clarify or refine fix the state instead"
          : "opens a lane on the triple shown above and hands it the brief";
      sb.onclick = () => void qAct(t.id, "dispatch",
        qDispatchBody("start", qSpawnPick.get(t.id) ?? Q_SPAWN_EMPTY, raw));
      place(sb, "start");
      if (spawnProblem) sb.disabled = true;
      if (raw) {
        sb.disabled = sb.disabled || qRawAck !== t.id;
        // its own line INSIDE the action row (flex-basis: 100%), directly under the button it
        // unlocks — the alternatives stay one line below, where they are read as alternatives
        const g = el("label", "qrawack");
        const box = el("input", "") as HTMLInputElement;
        box.type = "checkbox";
        box.checked = qRawAck === t.id;
        box.onchange = () => { qRawAck = box.checked ? t.id : null; renderQueueDetail(); };
        g.appendChild(box);
        g.appendChild(el("span", "", rawWhy));
        place(g, "start");
      }
    }
    // the same spawn with a different founding prompt: settle the done-criterion with the owner
    // before writing code. The standing answer to a "no done-criterion" blocker.
    // ▸ CLARIFY FIRST is the OTHER act, on its own handler: the same picked triple under
    // `clarify: true` (qDispatchBody "clarify"), never the raw acknowledgment. It does open a lane —
    // one that settles the done-criterion with you and waits — so the same block applies.
    if (startable) {
      const cb = el("button", mainCls("clarify"), "▸ clarify first") as HTMLButtonElement;
      cb.title = spawnProblem ? `blocked: ${spawnProblem}`
        : "opens a lane that works out the done-criterion WITH you and waits — no code until you confirm";
      cb.disabled = spawnProblem !== null;
      cb.onclick = () => void qAct(t.id, "dispatch",
        qDispatchBody("clarify", qSpawnPick.get(t.id) ?? Q_SPAWN_EMPTY, false));
      place(cb, "clarify");
    }
    // ↻ refine: rewrite the REQUEST itself — compile it into a work brief, or into the several
    // tasks it really is — before any lane sees it. Attended only; nothing on the server calls it.
    // Distinct from the brief editor above, and the difference is worth holding on to: refine
    // changes what you are asking for, the brief changes how it is said to the session.
    if (startable) {
      const rb = el("button", "shrbtn", t.refining ? "↻ refining…" : "↻ refine") as HTMLButtonElement;
      rb.disabled = t.refining === true;
      rb.title = "a read-only agent reads the repo and proposes a compiled brief — or a split."
        + " Nothing changes until you apply it";
      rb.onclick = () => void qAct(t.id, "refine", {});
      acts.appendChild(rb);
    }
    // RELEASING IS THE DECISION, and since 2026-09-10 it is the ONLY one: the queue analyst that
    // used to file an advisory verdict beside it — which renamed this button "release anyway ▸",
    // asked once, and booked a `task_override` — is retired, and so is the warning that named its
    // mode. What the owner is told instead is what the release will actually DO: which bytes the
    // lane receives. The wrapper stays, because a release-adjacent sentence is the one place that
    // fact is read before the click rather than after it.
    if (t.status === "pending") {
      const b = el("button", mainCls("release"), "release ▸") as HTMLButtonElement;
      b.title = "hands it to the dispatcher, which runs released tasks in order";
      b.onclick = () => void qAct(t.id, "queue");
      // ABSENCE IS NOT A CLAIM: while the full fetch is still in flight this pane cannot say
      // whether a brief exists, and it says so rather than promising the raw request.
      const release = el("div", "qrelease");
      release.appendChild(el("div", "qreleasenote", !qTaskFullLoaded(t.id)
        ? "Which bytes this release sends is still loading."
        : brief
          ? `The stored brief will be sent${brief.edited
            ? (briefByMain(brief) ? " — pinned by its Program-MAIN" : " — yours, pinned") : ""}.`
          : briefCompilerOn === true
            ? "No brief yet — the raw request will be sent unless the compiler writes one first."
            : "No brief, and no compiler is running — the raw request will be sent."));
      release.appendChild(b);
      place(release, "release");
    }
    if (t.status === "queued") acts.appendChild(mk("hold", "unqueue"));
  }
  // THE ③ HAKEN (Task.review): ask for an agentic code review of THIS row's lane. Offered while the
  // row can still reach a lane or runs in one — `sent` is the case that matters, the reviewer fires
  // when the lane looks done. Advisory by construction: the sentence says so, because a reader who
  // thought it gated the land would wait for it.
  if (t.kind === "auftrag" && (t.status === "pending" || t.status === "queued" || t.status === "sent")) {
    const g = el("label", "qrawack");
    const box = el("input", "") as HTMLInputElement;
    box.type = "checkbox";
    box.checked = t.review === "advisory";
    box.onchange = () => {
      box.disabled = true;
      void qAct(t.id, "review", { review: box.checked ? "advisory" : "none" }).then((ok) => {
        if (!ok) box.checked = !box.checked;
        box.disabled = false;
      });
    };
    g.appendChild(box);
    g.appendChild(el("span", "", "③ review this lane's code when it looks done — advisory: the verdict goes to "
      + (t.programId ? "its Program-MAIN (your 📥 inbox if none is live)" : "your 📥 inbox") + " and gates nothing"));
    acts.appendChild(g);
  }
  if (t.status === "archived") acts.appendChild(mk("restore", "unarchive"));
  if (t.status !== "done" && t.status !== "archived") acts.appendChild(mk("done", "done"));
  if (t.status !== "sent" && t.status !== "archived") acts.appendChild(mk("🗄 archive", "archive"));
  actionSection.appendChild(acts);
  // ▸ OPEN LANE is the only main action that is not a queue act: it makes no request at all, it
  // focuses the pane this row is already running in. Built here, beside the acts it replaces in
  // the head, so the head keeps exactly one action node whatever the status.
  if (head.main.act === "open-lane" && typeof head.main.slot === "number") {
    const slot = head.main.slot;
    const ob = el("button", "shrbtn primary", head.main.label ?? `▸ open lane — slot ${slot}`) as HTMLButtonElement;
    ob.title = `focuses slot ${slot} and closes this window — the queue is an overlay over the panes`;
    ob.onclick = () => { qShell?.close(); showSlot(slot); };
    mainBox.appendChild(ob);
  }
  const dangerActs = el("div", "pkdacts");
  dangerActs.appendChild(mk("✕ delete", "delete", "shrbtn danger"));
  danger.appendChild(el("div", "shellhint",
    "deleting drops the row and its thread for good — there is no restore. 🗄 archive above keeps it."));
  danger.appendChild(dangerActs);
  restoreFocus();
}

function qSelect(id: string | null) {
  // a selection change orphans an in-flight founding POST even when it does not reset the draft
  // (selecting a task, or a program whose pane returns before the draft block ever runs)
  if (id !== qPick) qBsSeq++;
  qPick = id;
  qKey = ""; // selection is painted on the rows, so they must be rebuilt
  renderQueue();
  renderQueueDetail();
  qShell?.showDetail(true);
}

function renderQueue() {
  const shell = qShell;
  if (!shell || !shell.isOpen()) return;
  void loadTaskTexts(); // no-op unless the visible task set changed
  void loadPrograms();  // no-op unless the poll's digest moved or the floor elapsed
  const model = qTaskListModel(tasksList, taskText, programsList, qQuery);
  const shown = model.work;
  const laneJoins = qLaneJoins(tasksList, fleet, dispatch.repo, serverNow);
  // REBUILD ONLY ON CHANGE. Without this the 2 s poll would rebuild the list under the cursor and
  // reset the selection every two seconds — the same class of defect as the compose box above.
  const now = Date.now();
  const key = JSON.stringify([qView, qPick, qQuery, qProgDone, dispatch.on, dispatch.available, intakeOn,
    Math.floor(now / 60000), qView === "waves" ? qWaveProjectionKey() : null,
    // the wave caveat's acknowledgment is a RENDER INPUT of this list, unlike qRawAck which lives
    // in the detail pane: without it here the checkbox flips, renderQueue is called, the key has
    // not moved, and the early return below leaves the button it unlocks disabled.
    qView === "waves" ? qWaveAck : null,
    // the lane line is derived from the slots too — a lane going idle or dirty moves no task field
    qLaneKey(laneJoins),
    // the MARK is derived from the slots, so it moves without any program field moving. Leaving
    // it out of the key would freeze a MAIN at `live` for as long as no task changed.
    programsRead, programsStale,
    programsList.map((p) => [p.id, p.status, p.title, programMark(p).mark]),
    [...model.work, ...model.history].map((t) => [t.id, t.status, t.slot, t.note, t.kind, t.briefAt,
      t.criterion ? t.criterion.confirmedAt === null : null, taskText.has(t.id),
      t.refine?.at, t.refining, t.comments?.n])]);
  if (key === qKey) return;
  qKey = key;

  // Each primary view names only its own domain. Waves keeps its weaker advisory claim and counts
  // everything deliberately kept outside; Work's counts stay global while a search narrows rows.
  const projection = qView === "waves" ? qWaveProjection() : null;
  if (qView === "work") {
    const n = (g: QGroup) => tasksList.filter((t) => qGroupOf(t) === g).length;
    shell.setSubtitle([`${n("needs")} need you`, `${n("released")} released`, `${n("running")} running`,
      `${n("backlog")} backlog`, intakeOn ? "✉ intake on" : ""].filter(Boolean).join(" · "));
  } else if (qView === "programs") {
    shell.setSubtitle(programsRead === "fail" ? "Programs unavailable — the last read failed"
      : `${programsList.length} program${programsList.length === 1 ? "" : "s"}`
        + (programsStale > 0 ? ` · ${programsStale} stale active` : ""));
  } else if (qView === "history") {
    const count = tasksList.filter(qClosed).length;
    shell.setSubtitle(`${count} done or archived task${count === 1 ? "" : "s"}`);
  } else if (projection) {
    const placed = projection.repos.reduce((n, repo) =>
      n + repo.waves.reduce((m, wave) => m + wave.tasks.length, 0), 0);
    shell.setSubtitle(`${placed} with no known collision · ${projection.unresolved.length} unresolved outside`);
  }

  shell.list.replaceChildren();
  const rows: ShellRow[] = [];
  let selIdx = -1;
  qRowId = new Map();
  const add = (o: { name: string; facts?: QRowFacts; cls?: string; id: string | null; sub?: HTMLElement | null }) => {
    const r = el("div", `shellrow${o.cls ? ` ${o.cls}` : ""}`);
    qRowId.set(r, o.id);
    const m = el("div", "shrmain");
    m.appendChild(el("div", "shrname", o.name));
    if (o.facts) {
      const facts = el("div", "qfacts");
      const classes = ["verdict", "age", "slot", "source"] as const;
      // an EMPTY fact draws nothing: a program with no binding has no slot to name, and an empty
      // span is a blank column that reads like a missing value. The index still fixes the class,
      // so the remaining facts keep their own colour (task rows never produce an empty fact).
      o.facts.forEach((fact, i) => {
        if (fact) facts.appendChild(el("span", `qfact qfact-${classes[i]}`, fact));
      });
      m.appendChild(facts);
    }
    if (o.sub) m.appendChild(o.sub);
    r.appendChild(m);
    const act = () => qSelect(o.id);
    r.onclick = act;
    shell.list.appendChild(r);
    if (o.id === qPick) { r.classList.add("sel"); selIdx = rows.length; }
    rows.push({ el: r, open: act });
  };

  const addTask = (t: TaskInfo) => {
    const summary = qTaskSummary(t, qTaskText(t.id), now);
    add({
      name: summary.title, facts: summary.facts, id: t.id,
      sub: qLaneLine(laneJoins.get(t.id) ?? { kind: "none" }),
      cls: [`q-${t.status}`, qAdvisory(t) ? "q-obs" : ""].filter(Boolean).join(" "),
    });
  };
  const addSection = (name: string, count: number, hint: string, visibleHint = false) => {
    const head = el("div", "shellsec");
    head.appendChild(el("span", "shellsect", name));
    head.appendChild(el("span", "shellsecn", String(count)));
    head.title = hint;
    shell.list.appendChild(head);
    if (visibleHint) shell.list.appendChild(el("div", "qwavehint", hint));
    return head;
  };

  let visibleRows = 0;
  if (qView === "programs") {
    const progMatch = programsList.filter((p) => !qQuery
      || p.id.toLowerCase().includes(qQuery) || p.title.toLowerCase().includes(qQuery) || p.status.includes(qQuery)
      || programMark(p).mark.includes(qQuery));
    // Complete programs stay in their own Program catalogue but begin folded; task History is a
    // different view. A search overrides this fold so a named Program can always be found here.
    const progDone = progMatch.filter((p) => p.status === "complete");
    const progFold = !qQuery && !qProgDone && progDone.length > 0;
    const progShown = progFold ? progMatch.filter((p) => p.status !== "complete") : progMatch;
    const progToggle = () => { qProgDone = !qProgDone; renderQueue(); };
    if (progShown.length || progDone.length || programsRead === "fail") {
      const head = addSection("Programs", progShown.length,
        "the owner's standing work frames. The MAIN mark is DERIVED on this poll — live only when"
        + " slot and openedAt both match a current occupant; stale when the binding is complete but"
        + " nothing matches; unknown when it cannot be checked at all, which is never read as live."
        + " `complete` programs are folded out of this list by default; a search still finds them.");
      // A COUNT THAT SHRANK MUST EXPLAIN ITSELF (the picker's ⎇ badge lesson, same vocabulary):
      // the badge names the hidden rows and routes to the toggle below rather than owning a
      // second copy of what hiding means.
      const badge = head.querySelector<HTMLElement>(".shellsecn");
      if (badge && progFold) {
        badge.textContent = `${progShown.length} · ${progDone.length} hidden`;
        badge.classList.add("reveal");
        badge.title = `${progDone.length} complete program${progDone.length === 1 ? "" : "s"}`
          + " hidden — click to show them";
        badge.onclick = (ev: MouseEvent): void => { ev.stopPropagation(); progToggle(); };
      }
      if (programsRead === "fail") shell.list.appendChild(el("div", "pknone",
        "GET /api/programs did not answer — these rows cannot be read right now"));
      for (const p of [...progShown].sort((a, b) => b.createdAt - a.createdAt)) {
        const { mark } = programMark(p);
        add({
          name: p.title, id: `prog:${p.id}`,
          cls: mark === "stale" || mark === "unknown" ? "q-flag" : "",
          facts: [`MAIN ${mark}`, p.status,
            p.main && typeof p.main.slot === "number" ? `slot ${p.main.slot}` : "", "program"],
        });
        visibleRows++;
      }
      if (!qQuery && progDone.length) {
        const t = el("button", "qfold",
          `${progFold ? "▸ show" : "▾ hide"} completed (${progDone.length})`) as HTMLButtonElement;
        t.type = "button";
        t.onclick = progToggle;
        shell.list.appendChild(t);
      }
    }
    if (!visibleRows && !progDone.length && programsRead !== "fail") shell.list.appendChild(el("div", "pknone",
      qQuery ? "no programs match this search" : "no programs yet"));
  } else if (qView === "history") {
    if (model.history.length) {
      addSection("History", model.history.length, "done and archived tasks, newest first");
      for (const task of [...model.history].sort((a, b) => b.created - a.created)) {
        addTask(task);
        visibleRows++;
      }
    } else shell.list.appendChild(el("div", "pknone",
      qQuery ? "no historical tasks match this search" : "History is empty — no done or archived tasks"));
  } else if (qView === "work") {
    if (!qQuery) add({ name: "＋ New task", cls: "qnew", id: null });
    for (const g of Q_GROUPS) {
      const group = model.work.filter((t) => qGroupOf(t) === g.k);
      if (!group.length) continue;
      addSection(g.head, group.length, g.hint);
      // "Released" is the ONE group with a real order — it is the dispatcher's own pick order
      // (tasks.find over creation order), so showing it newest-first would be a lie about what runs
      // next. Everywhere else newest-first is what you want.
      const sorted = g.k === "released"
        ? [...group].sort((a, b) => a.created - b.created)
        : [...group].sort((a, b) => b.created - a.created);
      for (const t of sorted) { addTask(t); visibleRows++; }
    }
    // Search is the sole exception to History's explicit view: a closed task that matches must be
    // findable from the default Work surface, but an empty query never leaks one historical row.
    if (model.showHistoryInWork) {
      addSection("History", model.history.length, "search matches among done and archived tasks");
      for (const task of [...model.history].sort((a, b) => b.created - a.created)) {
        addTask(task);
        visibleRows++;
      }
    }
    if (!visibleRows) shell.list.appendChild(el("div", "pknone", qQuery
      ? "no tasks match this search"
      : `Work is clear — no open tasks.${model.history.length
        ? ` Choose History to inspect ${model.history.length} done or archived task${model.history.length === 1 ? "" : "s"}.`
        : ""}`));
  } else if (projection) {
    const visibleIds = new Set(shown.map((t) => t.id));
    const taskById = new Map(tasksList.map((t) => [t.id, t]));
    for (const repo of projection.repos) for (const wave of repo.waves) {
      const items = wave.tasks.filter((item) => visibleIds.has(item.id));
      if (!items.length) continue;
      const hint = `Target repo: ${repo.repo}. First-fit, at most ${projection.capacity} lanes.`
        + " Known file intersections excluded; an unknown surface never enters a wave.";
      addSection(`${baseName(repo.repo)} · Wave ${wave.index} · no known collision`, items.length, hint, true);
      for (const item of items) {
        const task = taskById.get(item.id);
        if (task) { addTask(task); visibleRows++; }
      }
    }
    const unresolvedGroups: { reason: TaskWaveUnresolved["reason"]; head: string; hint: string }[] = [
      { reason: "unknown-files", head: "Outside waves · unknown surface",
        hint: "No known file surface. Unknown is not empty, so no collision claim is made." },
      { reason: "unknown-repo", head: "Outside waves · unknown target repo",
        hint: "Neither the task nor dispatcher resolves a target repo, so it cannot enter a repo wave." },
      { reason: "no-capacity", head: "Outside waves · no lane capacity",
        hint: "dispatch.maxLanes is zero; no wave can honestly contain a lane." },
    ];
    for (const group of unresolvedGroups) {
      const items = projection.unresolved.filter((item) =>
        item.reason === group.reason && visibleIds.has(item.id));
      if (!items.length) continue;
      addSection(group.head, items.length, group.hint, true);
      for (const item of items) {
        const task = taskById.get(item.id);
        if (task) { addTask(task); visibleRows++; }
      }
    }
    // THE OTHER FOLD, beneath the parallel one. A land wave is a statement about a SET of rows, so
    // it renders as ONE line per wave and never as task rows. qWaveProjectionKey already covers
    // every fact it consumes (id/repo/kind/status/created/files/filesOrigin/programId and
    // dispatch.repo), so this list repaints with the view instead of under the cursor.
    //
    // A wave of ONE stays exactly the sensor line it has always been — no button, no evidence, no
    // acknowledgment — because there is nothing to bundle and the reason against it is the whole
    // message. A wave of n>1 grows the ▸ start wave button of W3, and with it the evidence the
    // owner is deciding on.
    const land = qLandWaveProjection();
    const landWaves = land.repos.flatMap((repo) => repo.waves
      .filter((wave) => wave.ids.some((id) => visibleIds.has(id)))
      .map((wave) => ({ repo: repo.repo, wave })));
    if (landWaves.length) {
      addSection("Lande-Wellen", landWaves.length,
        "Which rows could land TOGETHER in one lane: connected components over CONFIRMED file"
        + " surfaces (and CARD surfaces, joined by nearby ranges only), class-pure and INSIDE ONE PROGRAM (files alone fold almost every row into one"
        + ` clump), cut at a budget of ${land.budget} size units (klein=1 · mittel=2 · gross=3, no card size = mittel)`
        + ` and at most ${LAND_WAVE_ROWS_MAX} rows. The saving is median seconds per avoided land`
        + " (gate + post-land audit); a wave of one names the reason against bundling.",
        true);
      for (const { repo, wave } of landWaves) {
        // A bundlable row that simply found no partner has no reason AGAINST it — say that, rather
        // than borrowing one of the three verdicts it did not earn.
        const reason = wave.reasonAgainst ?? (wave.ids.length > 1 ? "bündelbar" : "kein Partner");
        const line = el("div", "qwavehint qwaveland",
          `${baseName(repo)} · ${wave.ids.join(" + ")} · ${wave.klasse} · ${wave.savingsSec}s · ${reason}`);
        if (wave.ids.length > 1) qLandWaveStart(line, wave);
        shell.list.appendChild(line);
        visibleRows++;
      }
    }
    if (!visibleRows) shell.list.appendChild(el("div", "pknone",
      qQuery ? "no wave candidates match this search" : "no queued auftrag rows to project"));
  }
  shell.setRows(rows);
  if (selIdx >= 0) shell.select(selIdx, false, false);
}

$("queuebtn").onclick = () => openQueue();

function openQueue() {
  setDrawer(false);
  qShell?.close();
  qPick = null;
  qQuery = "";
  qView = "work";
  qProgDone = false;
  qKey = "";
  qCompose = null;
  qRepoIn = null;
  qProgSel = null;
  qCmBox = null;
  qCmFor = null;
  qBriefDraft = null;
  qCriterionDraft = null;
  qRawAck = null;
  qWaveAck = null;
  qSpawnPick.clear(); qSpawnUi = null;
  qBsFor = null; qBsCwd = null; qBsLabel = null; qBsErr = null; qBsBusy = false; qBsSeq++;
  qBsHarness = null; qBsModel = ""; qBsEffort = "";
  // (4) the founding flow's harness/model/effort row AND a task row's spawn pickers read this
  // catalogue. It is fetched once per app life, so it can land AFTER a pane is already open —
  // repaint that pane exactly once when it does, instead of leaving the row missing until the
  // owner comes back to it.
  void loadHarnesses().then(() => {
    if (qShell?.isOpen() && qPick !== null) {
      qDetailKey = "";
      renderQueueDetail();
    }
  });
  void loadPrograms(true);
  const shell = openShell({
    id: "queue",
    title: "Task queue",
    listWidth: 380,
    onSelect: (row) => { if (qRowId.has(row.el)) qSelect(qRowId.get(row.el) ?? null); },
    onClose: () => {
      qShell = null; qCompose = null; qRepoIn = null; qProgSel = null; qCmBox = null; qCmFor = null;
      qBriefDraft = null; qCriterionDraft = null; qRawAck = null; qWaveAck = null; qRowId = new Map();
      qSpawnPick.clear(); qSpawnUi = null;
      qBsFor = null; qBsCwd = null; qBsLabel = null; qBsErr = null; qBsBusy = false; qBsSeq++;
    },
  });
  qShell = shell;

  const view = el("div", "qview");
  view.setAttribute("role", "group");
  view.setAttribute("aria-label", "Task queue views");
  const views = ([
    ["work", "Work"], ["programs", "Programs"], ["history", "History"], ["waves", "Waves"],
  ] as const).map(([id, label]) => {
    const button = el("button", "", label) as HTMLButtonElement;
    button.type = "button";
    return { id, button };
  });
  const paintView = () => {
    for (const item of views) {
      const selected = qView === item.id;
      item.button.classList.toggle("on", selected);
      item.button.setAttribute("aria-pressed", String(selected));
    }
  };
  const chooseView = (next: QView) => {
    if (qView === next) return;
    if (qPick !== null) qBsSeq++;
    qView = next;
    qPick = null;
    qRawAck = null;
    qKey = "";
    qDetailKey = "";
    paintView();
    renderQueue();
    renderQueueDetail();
  };
  for (const item of views) item.button.onclick = () => chooseView(item.id);
  view.append(...views.map((item) => item.button));
  paintView();
  shell.tools.appendChild(view);

  const search = el("input", "pkfilterin") as HTMLInputElement;
  search.type = "text";
  search.spellcheck = false;
  search.placeholder = "search tasks — text, ID, status, repo or program";
  search.setAttribute("aria-label", "Search tasks by text, ID, status, repository or program");
  search.addEventListener("input", () => { qQuery = search.value.trim().toLowerCase(); qKey = ""; renderQueue(); });
  shell.tools.appendChild(search);

  const drow = el("div", "qdisp");
  if (dispatch.available) {
    // the strip lives OUTSIDE the poll-guarded list rebuild, so it repaints itself from `dispatch`
    // after a toggle rather than waiting for a rebuild that may never come
    const label = el("span", "");
    const toggle = el("button", "shrbtn", "") as HTMLButtonElement;
    // it says what it RUNS, not merely that it is on. The single most important fact about this
    // switch is the one it never used to state: it takes released tasks and nothing else — it
    // does not pick work out of the backlog, which is exactly what its predecessor did.
    const paint = () => {
      label.textContent = dispatch.on
        ? `Dispatcher ON — runs released tasks unattended, up to ${dispatch.maxLanes} lanes in ${baseName(dispatch.repo)}. It never picks its own. `
        : `Dispatcher off — released tasks wait for you to start them by hand (${baseName(dispatch.repo)}). `;
      toggle.textContent = dispatch.on ? "turn off" : "turn on";
    };
    toggle.onclick = async () => {
      const r = await post("/api/dispatch", { on: !dispatch.on });
      if (!r.ok) toast("couldn't toggle the dispatcher");
      await refresh();
      qKey = "";
      renderQueue();
      paint();
    };
    paint();
    drow.append(label, toggle);
  } else {
    drow.textContent = "Dispatcher unavailable (set FLEET_DISPATCH_REPO to auto-run queued tasks)."
      + " Tasks are still tracked; send them by hand.";
  }
  shell.tools.appendChild(drow);

  shell.foot.textContent = "backlog → its brief is compiled → you release ▸"
    + " → a ⎇ lane runs it → ± review → ⏏ land.  Releasing is yours."
    + "  Sidebar badge: •N uncommitted · ↑N to push · amber = editing · green = ready to land";

  renderQueue();
  renderQueueDetail();
  search.focus();
}

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
    case "slot_shelve": {
      const m = detail?.match(/^note:(\d+)$/);
      return m ? `shelved · ${m[1]}-char note` : "shelved";
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
  else if (typeof e.slot === "number") shell.detail.appendChild(el("div", "shellhint",
    "no project on record for this event — the slot's opening is older than the loaded window,"
    + " or the slot had been closed. Deliberately not filled in from a LATER opening: that folder"
    + " is where the slot went next, not where this happened."));
  if (e.detail) shell.detail.appendChild(el("div", "qdtext", e.detail));

  if (typeof e.slot !== "number") {
    shell.detail.appendChild(el("div", "shellhint",
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
    shell.detail.appendChild(el("div", "shellhint",
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
  if (!cmData) { shell.list.appendChild(el("div", "shellhint", "loading…")); shell.setRows([]); return; }
  if (cmData.error) { shell.list.appendChild(el("div", "shellhint", cmData.error)); shell.setRows([]); return; }

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
  body.appendChild(el("div", "shellhint", "reading the change…"));
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
    if (!repo) { body.appendChild(el("div", "shellhint", "no repo selected")); return; }
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
      body.appendChild(el("div", "shellhint",
        "no textual diff — a merge commit shows none against its first parent, and a commit that"
        + " only moves metadata (a mode or an empty tree) has none either"));
      return;
    }
    const box = el("div", "difftxt");
    renderDiffInto(box, d.diff);
    body.appendChild(box);
    if (d.truncated) body.appendChild(el("div", "shellhint", "diff truncated — open the commit in a terminal for the rest"));
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
    const note = el("div", "shellhint", "checking the land ledger…");
    shell.detail.appendChild(note);
    void loadLens("lands").then(() => {
      if (shell.isOpen() && cmPick === c.hash && actLens === "commits") renderCommitDetail(c);
    });
  } else if (!near.length) {
    shell.detail.appendChild(el("div", "shellhint",
      "no land recorded within an hour of this commit — it was probably committed by hand"));
  } else {
    for (const o of near) {
      const line = el("div", "shrsub");
      line.textContent = `${fmtTs(o.ts)} · ${(o.branch ?? "(branch not recorded)").replace(/^fleet\//, "")}`
        + `${o.shortstat ? ` · ${o.shortstat}` : ""}`;
      shell.detail.appendChild(line);
    }
    shell.detail.appendChild(el("div", "shellhint",
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
  // HOW the row reached that model (server.ts#resolvedModel, rows since 2026-09-17): "spawn" the
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

function fmtDur(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h}h ${min % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
}
function chip(text: string, cls = "", title = ""): HTMLElement {
  const c = el("span", `occhip${cls ? ` ${cls}` : ""}`, text);
  if (title) c.title = title;
  return c;
}

// what ③ actually said, under the constraints above. Returns the body rows for one outcome.
function reviewBody(r: OutcomeReviewRow): HTMLElement[] {
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
    // could read as "these rows share a brief".
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
        row.appendChild(el("div", "shellhint", `${OC_FILE_ROWS} of ${touched.length} shown`));
      if (!at)
        row.appendChild(el("div", "shellhint", dispo === "landed" || dispo === "reverted"
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
  if (n === 0) { host.appendChild(el("div", "shellhint", emptyWord)); return null; }
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
  else if (akteBusy) { shell.detail.replaceChildren(); shell.detail.appendChild(el("div", "shellhint", "reading…")); }
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
  if (cut.length) host.appendChild(el("div", "shellhint", `not shown: ${cut.join(", ")} — this trail is capped at its most recent entries`));
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
      host.appendChild(el("div", "shellhint", "no verify is recorded on this note — the land ran none"));
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
  const sw = el("div", "actlens");
  for (const l of ACT_LENS) {
    const b = el("button", `shrbtn${actLens === l.k ? " active" : ""}`, l.label) as HTMLButtonElement;
    b.title = l.title;
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

async function openActivity(lens: ActLens, at?: { repo: string | null; hash: string }) {
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
$("outcomebtn").onclick = () => void openActivity("lands");

// ⋯ mehr — the board-wide fold under the header row: every NEW or secondary board action goes
// in here first, never into the row above; promoting one to the row is its own owner call.
let moreOpen = localStorage.getItem("fleet.more") === "1";
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
  localStorage.setItem("fleet.more", moreOpen ? "1" : "0");
  applyMore();
};
$("sidetools").appendChild(moreBtn);
$("sidetools").after(morePanel);
applyMore();

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

function fmtSince(ts: number): string {
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
      box.appendChild(el("div", "shrqrhint", "scan to open the share link — password still needed"));
      sharepanel.appendChild(box);
    }
    sharepanel.appendChild(copyLine("password", sh.password));
    // A share is view-only, always — there is no switch here because there is no mode to
    // switch. The guest's channel back is the comment thread below, which you read and act on.
    const accessRow = el("div", "shrline");
    accessRow.appendChild(el("span", "k", "access"));
    accessRow.appendChild(el("span", "v", "view only"));
    sharepanel.appendChild(accessRow);
    sharepanel.appendChild(el("div", "shrhint",
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
    sharepanel.appendChild(el("div", "shrhint",
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

function openShareDlg(slotId: number) {
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

function renderAutoDlg() {
  const s = fleet[autoSlot - 1];
  if (!s?.cwd) { closeAutoDlg(); return; }
  autopanel.replaceChildren();
  autopanel.appendChild(el("h2", "", `Scheduled prompts — ${s.label ?? baseName(s.cwd)}`));
  const mine = autosList.filter((a) => a.slot === autoSlot);
  if (!mine.length) autopanel.appendChild(el("div", "shrhint", "No schedules for this session."));
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

// --- the attention inbox (📣): what a bound Program-MAIN raised for the OWNER — a decision, a
// block, something ready for review — and the one bound answer back. It lives OUTSIDE the compose
// box on purpose: an item that only ever appeared as pane text in one session is an item the owner
// can miss entirely, which is the failure this channel exists to remove.
//
// Its cost on the 2s poll is one number (attentionOpen). The rows come from GET /api/attention when
// this panel opens, and again when that number MOVES while it is open — never on a timer of its own.
// The interfaces below are LOCAL and describe exactly what the server emits; nothing here is cast
// onto the /api/sessions payload, which carries the count and nothing else.
interface AttentionRow {
  id: string; raisedAt: number; kind: "decision" | "blocked" | "review-ready"; text: string;
  requester: { slot: number; openedAt: number; sessionId: string | null };
  programId: string; programTitle: string | null;
  status: "open" | "send-uncertain" | "answered" | "refused";
  answer: { text: string; at: number; by: "owner" } | null;
  refusedReason: string | null; closedAt: number | null;
  // derived by the server at read time for an ANSWERED row, null otherwise (server.ts#attentionDelivery)
  delivery: AttentionDelivery | null;
}
type AttentionNudgeReading =
  | { outcome: "unknown"; why: string }
  | { outcome: "accepted"; at: number }
  | { outcome: "unobserved"; at: number; acceptance: string }
  | { outcome: "not-accepted"; at: number; failure: string; reason: string };
type AttentionDelivery =
  | { state: "read"; entryId: string; since: number; readAt: number; readBy: { slot: number } }
  | { state: "unread"; entryId: string; since: number; lastNudge: AttentionNudgeReading }
  | { state: "unknown"; why: string };
const attndlg = $("attndlg"), attnpanel = $("attnpanel"), attnbtn = $("attnbtn");
let attentionOpen = 0;
let attnRows: AttentionRow[] = [];
let attnErr: string | null = null;
let attnBusy = false;
// typed-but-unsent answers survive a repaint: the rows are rebuilt whenever the count moves, and
// losing a half-written answer to an unrelated arrival would be its own reason not to use this.
const attnDraft = new Map<string, string>();

function renderAttnBtn() {
  attnbtn.textContent = attentionOpen > 0 ? `📣${attentionOpen}` : "📣";
  attnbtn.classList.toggle("hot", attentionOpen > 0);
  // the affordance appears only when something is actually waiting — an always-present empty inbox
  // trains the eye to ignore it, and there is nothing to open when the count is zero
  attnbtn.style.display = attentionOpen > 0 || attndlg.style.display === "flex" ? "" : "none";
}

function setAttentionOpen(n: number) {
  const moved = n !== attentionOpen;
  attentionOpen = n;
  renderAttnBtn();
  if (moved && attndlg.style.display === "flex") void loadAttention();
}

async function loadAttention() {
  const res = await api("/api/attention");
  if (!res.ok) { attnErr = `could not load the inbox (${res.status})`; renderAttnDlg(); return; }
  const data = (await res.json()) as { requests?: AttentionRow[] };
  attnRows = data.requests ?? [];
  attnErr = null;
  renderAttnDlg();
}

function closeAttnDlg() {
  attndlg.style.display = "none";
  renderAttnBtn();
}
attndlg.addEventListener("click", (e) => {
  if (e.target === attndlg) closeAttnDlg();
});

const ATTN_KIND_TITLE: Record<AttentionRow["kind"], string> = {
  decision: "a decision only the owner can make",
  blocked: "the program is blocked until the owner acts",
  "review-ready": "something is ready for the owner to review",
};

function attnOpenRow(a: AttentionRow): HTMLElement {
  const row = el("div", `attnrow ${a.status === "send-uncertain" ? "uncertain" : "open"}`);
  const head = el("div", "attnhead");
  const chip = el("span", `attnkind k-${a.kind}`, a.kind);
  chip.title = ATTN_KIND_TITLE[a.kind];
  head.appendChild(chip);
  head.appendChild(el("span", "attnprog", a.programTitle ?? `program ${a.programId} (title not resolvable)`));
  head.appendChild(el("span", "attnmeta", `slot ${a.requester.slot} · ${fmtSince(a.raisedAt)}`));
  row.appendChild(head);
  row.appendChild(el("div", "attntext", a.text));
  if (a.status === "send-uncertain")
    row.appendChild(el("div", "attnwarn",
      "answer send unresolved — it may already be in the session's pane. Retry sends the identical text; a different answer is refused."));
  const ta = document.createElement("textarea");
  ta.className = "attnta";
  ta.rows = 3;
  // an unresolved send has exactly one legal answer: the pending text, byte for byte
  ta.value = a.status === "send-uncertain" ? (a.answer?.text ?? "") : (attnDraft.get(a.id) ?? "");
  ta.readOnly = a.status === "send-uncertain";
  ta.placeholder = "Your answer — it is delivered into that session's pane.";
  ta.addEventListener("input", () => attnDraft.set(a.id, ta.value));
  row.appendChild(ta);
  const btns = el("div", "shrbtns");
  const answer = el("button", "shrbtn primary",
    a.status === "send-uncertain" ? "retry send" : "answer") as HTMLButtonElement;
  answer.disabled = attnBusy;
  answer.onclick = async () => {
    const text = ta.value.trim();
    if (!text) { toast("an answer needs text"); return; }
    attnBusy = true;
    const res = await post(`/api/attention/${a.id}/answer`, { text });
    attnBusy = false;
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast(err.error ?? "the answer was not delivered");
    } else attnDraft.delete(a.id);
    await refresh();
    await loadAttention();
  };
  const refuse = el("button", "shrbtn", "refuse") as HTMLButtonElement;
  refuse.title = "dismiss without answering — the reason is the receipt that you saw it";
  refuse.disabled = attnBusy;
  refuse.onclick = async () => {
    const reason = prompt("Why are you declining this? (recorded on the row)")?.trim();
    if (!reason) return;
    attnBusy = true;
    const res = await post(`/api/attention/${a.id}/refuse`, { reason });
    attnBusy = false;
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast(err.error ?? "the refusal did not stick");
    }
    await refresh();
    await loadAttention();
  };
  btns.append(answer, refuse);
  row.appendChild(btns);
  return row;
}

function attnClosedRow(a: AttentionRow): HTMLElement {
  const row = el("div", `attnrow done ${a.status}`);
  const head = el("div", "attnhead");
  head.appendChild(el("span", `attnkind k-${a.kind}`, a.kind));
  head.appendChild(el("span", "attnprog", a.programTitle ?? `program ${a.programId}`));
  head.appendChild(el("span", "attnmeta", `${a.status} · ${fmtSince(a.closedAt ?? a.raisedAt)}`));
  row.appendChild(head);
  const outcome = a.status === "answered" ? a.answer?.text ?? "" : a.refusedReason ?? "";
  const line = el("div", "attnclosed", `${a.text} → ${outcome}`);
  line.title = outcome;
  row.appendChild(line);
  if (a.delivery) row.appendChild(attnDeliveryLine(a.delivery));
  return row;
}

// The answer is a Program inbox pointer, never a paste — so "answered" says nothing about whether
// the MAIN has it. This line says what the server can prove, and "unknown" where it cannot.
function attnDeliveryLine(d: AttentionDelivery): HTMLElement {
  if (d.state === "read")
    return el("div", "shrhint", `read by slot ${d.readBy.slot} · ${fmtSince(d.readAt)}`);
  if (d.state === "unknown") return el("div", "attnwarn", `delivery unknown — ${d.why}`);
  const n = d.lastNudge;
  const nudge = n.outcome === "unknown" ? `last nudge unknown (${n.why})`
    : n.outcome === "accepted" ? `last nudge accepted ${fmtSince(n.at)}`
    : n.outcome === "unobserved" ? `last nudge typed, acceptance ${n.acceptance} ${fmtSince(n.at)}`
    : `last nudge NOT accepted ${fmtSince(n.at)}: ${n.reason}`;
  return el("div", n.outcome === "accepted" ? "shrhint" : "attnwarn", `unread since ${fmtSince(d.since)} · ${nudge}`);
}

function renderAttnDlg() {
  attnpanel.replaceChildren();
  attnpanel.appendChild(el("h2", "", "Attention — raised by a program's main session"));
  if (attnErr) attnpanel.appendChild(el("div", "attnwarn", attnErr));
  const live = attnRows.filter((a) => a.status === "open" || a.status === "send-uncertain");
  const closed = attnRows.filter((a) => a.status === "answered" || a.status === "refused");
  if (!live.length) attnpanel.appendChild(el("div", "shrhint", "Nothing is waiting on you."));
  for (const a of live) attnpanel.appendChild(attnOpenRow(a));
  if (closed.length) {
    attnpanel.appendChild(el("div", "attnsep", "settled"));
    for (const a of closed) attnpanel.appendChild(attnClosedRow(a));
  }
  const btns = el("div", "shrbtns");
  const close = el("button", "shrbtn", "close") as HTMLButtonElement;
  close.onclick = closeAttnDlg;
  btns.appendChild(close);
  attnpanel.appendChild(btns);
}

attnbtn.onclick = () => {
  setDrawer(false);
  attndlg.style.display = "flex";
  renderAttnDlg();
  void loadAttention();
};
renderAttnBtn();

// --- the OPERATIONS inbox (📥): FleetEvents whose subscription asked for delivery:"inbox" instead
// of pane text. STRICTLY SEPARATE from 📣 above and never merged with it: that inbox carries what
// needs an owner DECISION, this one carries completion FACTS an owner-attended session subscribed
// to — a merge outcome, a post-land audit, a deploy, a lane reaching a completion predicate.
// Acknowledging is a receipt that the owner saw it, nothing else; it starts no work.
//
// No request of its own: the 2 s poll carries exactly the rows this panel can show, projected to
// the fields it prints (src/opsevents.ts#opsPollRow). Every other row — terminal, receiver-gone,
// and the inbox reports the section below loads itself — lives behind GET /api/events.
const opsdlg = $("opsdlg"), opspanel = $("opspanel"), opsbtn = $("opsbtn");
let opsRows: OpsPollRow[] = [];
let opsBusy = false;

// --- the THIRD class in this panel, and the one whose rows are not events at all: worker reports
// that no session can judge any more. A bound report's FleetEvent goes `receiver-gone` the moment
// its MAIN is torn down — terminal, and therefore in NEITHER class above (opsOpen wants an inbox
// row, opsUnacked wants a live pane debt). The row was the owner's to settle and nothing showed it
// to him, which is why a fleet accumulated panes: retiring a MAIN with an unjudged report made the
// verdict permanently unreachable instead of merely inconvenient.
//
// It costs one number on the 2s poll (`reportsAwaitingOwner`); the rows come from
// GET /api/fleet-report when this panel opens and again when that number MOVES while it is open —
// the attention panel's rule exactly, for its reason.
interface OwnerReportRow {
  id: string; reportedAt: number; status: "complete" | "needs-main" | "failed" | "handoff"; text: string;
  worker: { slot: number; openedAt: number; sessionId: string | null; cwd: string; branch: string };
  provenance: { taskId: string | null; originId: string | null; programId: string | null;
    instance?: string | null };
  receiver: { slot: number; openedAt: number; sessionId: string | null } | null;
  basis: "program-main" | "lane-watch" | "program-main+lane-watch" | "owner-inbox" | "program";
  eventId: string | null;
  // derived server-side per request from the one rule both decision doors read
  liveness: "live" | "gone" | "owner-inbox";
  decision?: { disposition: "accepted" | "rejected"; at: number;
    by: { slot: number; openedAt: number; sessionId: string | null } | "owner";
    reason: string | null } | null;
  // server/types.ts#FleetReport.outsideSurface — null/absent = not measured, [] = nothing outside
  outsideSurface?: string[] | null;
}
let reportsAwaitingOwner = 0;
let ownerReportRows: OwnerReportRow[] = [];
let ownerReportErr: string | null = null;
// typed-but-unsent reasons survive a repaint, for attnDraft's reason: the rows are rebuilt whenever
// the count moves, and losing a half-written reason to an unrelated arrival is its own deterrent.
const ownerReportDraft = new Map<string, string>();
const ownerReportAwaiting = (r: OwnerReportRow): boolean => !r.decision && r.liveness !== "live";

// EVERY inbox row EXCEPT a worker report. The report rail counts its own rows and renders them in
// its own section below, and it counts BOTH carriers — the owner-inbox row that arrives here as an
// inbox event, and the orphaned bound row whose event went terminal on teardown and arrives here as
// nothing at all. Leaving fleet-report rows in this class would count the first kind twice and show
// it in two places, with an `acknowledge` button beside a `reject` one for the same row.
const opsOpenNonReport = (rows: OpsPollRow[]): OpsPollRow[] =>
  opsOpen(rows).filter((e) => e.kind !== "fleet-report");

function renderOpsBtn() {
  // FILED FOR THE OWNER, one meaning, two carriers: an inbox event of any other kind, and a worker
  // report no session can judge. Both are rows that want the OWNER to close them, so they are one
  // number — this is not the forbidden sum below, which would add a count that wants nobody.
  const n = opsOpenNonReport(opsRows).length + reportsAwaitingOwner;
  // TWO NUMBERS, NEVER A SUM. Filed operations want the owner to close them; unacknowledged pane
  // transport wants nobody — it is a report. Adding them would make one count mean two things.
  const m = opsUnacked(opsRows, Date.now()).length;
  opsbtn.textContent = `📥${n > 0 ? n : ""}${m > 0 ? ` ⚠${m}` : ""}`;
  opsbtn.classList.toggle("hot", n > 0);
  opsbtn.title = `${n} filed for you (${reportsAwaitingOwner} worker report(s) no session can judge)`
    + ` · ${m} pane event(s) sent without a session acknowledgement`;
  // same rule as 📣: no affordance while nothing is filed, so the icon means something when it appears
  opsbtn.style.display = n > 0 || m > 0 || opsdlg.style.display === "flex" ? "" : "none";
}

function setOpsEvents(rows: OpsPollRow[]) {
  opsRows = rows;
  renderOpsBtn();
  if (opsdlg.style.display === "flex") renderOpsDlg();
}

function setReportsAwaitingOwner(n: number) {
  const moved = n !== reportsAwaitingOwner;
  reportsAwaitingOwner = n;
  renderOpsBtn();
  if (moved && opsdlg.style.display === "flex") void loadOwnerReports();
}

async function loadOwnerReports() {
  const res = await api("/api/fleet-report");
  if (!res.ok) { ownerReportErr = `could not load the reports (${res.status})`; renderOpsDlg(); return; }
  const data = (await res.json()) as { reports?: OwnerReportRow[] };
  ownerReportRows = data.reports ?? [];
  ownerReportErr = null;
  renderOpsDlg();
}

function closeOpsDlg() {
  opsdlg.style.display = "none";
  renderOpsBtn();
}
opsdlg.addEventListener("click", (e) => {
  if (e.target === opsdlg) closeOpsDlg();
});

// who this row is FOR. Slot-bound rows name their receiver occupant; an owner row names nobody,
// because nobody is what it has — saying "receiver slot null" would read as a lost binding.
function opsReceiver(e: OpsPollRow): string {
  return e.receiverSlot === null ? "filed for you" : `receiver slot ${e.receiverSlot}`;
}

function opsRow(e: OpsPollRow): HTMLElement {
  const row = el("div", "attnrow open");
  const head = el("div", "attnhead");
  // a worker report carries its own verdict, so the chip shows it: a `failed` and a `complete`
  // must not look alike in a list the owner scans.
  const status = String((e.payload ?? {}).status ?? "");
  const chip = e.kind !== "fleet-report" ? "k-review-ready"
    : status === "failed" ? "k-blocked" : status === "needs-main" ? "k-decision"
      : status === "handoff" ? "k-handoff" : "k-review-ready";
  head.appendChild(el("span", `attnkind ${chip}`, e.kind));
  head.appendChild(el("span", "attnprog", opsSubject(e)));
  head.appendChild(el("span", "attnmeta", `${opsReceiver(e)} · ${fmtSince(e.createdAt)}`));
  row.appendChild(head);
  row.appendChild(el("div", "attntext", opsSummary(e)));
  const btns = el("div", "shrbtns");
  const ack = el("button", "shrbtn primary", "acknowledge") as HTMLButtonElement;
  ack.title = "a receipt that you saw this — it starts nothing and changes no lane";
  ack.disabled = opsBusy;
  ack.onclick = async () => {
    opsBusy = true;
    const res = await post(`/api/events/${e.id}/ack`, {});
    opsBusy = false;
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast(err.error ?? "the acknowledgement did not stick");
    }
    await refresh();
    renderOpsDlg();
  };
  btns.appendChild(ack);
  row.appendChild(btns);
  return row;
}

// PLACED AHEAD OF THE READ-ONLY TRANSPORT ROW ON PURPOSE, and it must stay ahead of it:
// e2e/watch.ts proves that row by slicing this file between the two definitions that bracket it
// and asserting the window holds no ack, no post and no "failed". A row with buttons sitting
// inside that window fails those checks as if the read-only row had grown affordances — measured
// on the first run of this cut. (The probe now anchors on a line start, so this paragraph can
// name neither definition without becoming the slice itself — which is how it broke the second
// time. Both halves of that lesson are load-bearing.)
//
// One awaiting report, with the two acts that were missing. The verdict is the OWNER'S — the row
// says so, and the panel says so — because the MAIN it was filed to is gone; stamping it as that
// MAIN's would record a judgement by a session that had already ended.
function ownerReportRowEl(r: OwnerReportRow): HTMLElement {
  const row = el("div", "attnrow open");
  const head = el("div", "attnhead");
  // a `handoff` is the one status that reports no verdict at all: the lane is still running, one
  // session further on. Its own chip, so an owner scanning this list never reads a baton as a
  // finished slice (green) — the two ask for entirely different things from him, which is nothing
  // and a look, respectively.
  const chip = r.status === "failed" ? "k-blocked" : r.status === "needs-main" ? "k-decision"
    : r.status === "handoff" ? "k-handoff" : "k-review-ready";
  if (r.basis === "program") head.appendChild(el("span", "attnkind", "Program"));
  head.appendChild(el("span", `attnkind ${chip}`, r.status));
  head.appendChild(el("span", "attnprog", `slot ${r.worker.slot} · ${r.worker.branch}`));
  head.appendChild(el("span", "attnmeta", `${fmtSince(r.reportedAt)}`));
  row.appendChild(head);
  // WHY THIS ROW IS HERE AT ALL, stated rather than left to be inferred from an empty receiver
  // field: an absence that looks like "nobody has looked at it" is the state this section removes.
  row.appendChild(el("div", "shrhint", r.basis === "program"
    ? `Filed to Program ${r.provenance.programId}; it currently has no live bound MAIN, so the owner may judge it.`
    : r.liveness === "owner-inbox"
      ? "Filed to you directly — the lane had no coordinating session to report to."
      : `Filed to slot ${r.receiver?.slot}, whose session has since ended. No session can judge it any more.`));
  row.appendChild(el("div", "attntext", r.text));
  if (r.outsideSurface?.length)
    row.appendChild(el("div", "shrhint", `Committed outside the card's write surface: ${r.outsideSurface.join(", ")}`));
  const ta = document.createElement("textarea");
  ta.className = "attnta";
  ta.rows = 2;
  ta.value = ownerReportDraft.get(r.id) ?? "";
  ta.placeholder = "Reason (optional) — it is recorded on the row, not sent anywhere.";
  ta.addEventListener("input", () => ownerReportDraft.set(r.id, ta.value));
  row.appendChild(ta);
  const btns = el("div", "shrbtns");
  for (const verdict of ["accept", "reject"] as const) {
    const b = el("button", `shrbtn${verdict === "accept" ? " primary" : ""}`, verdict) as HTMLButtonElement;
    b.title = "your verdict, recorded as the owner's — this records a judgement and starts nothing";
    b.disabled = opsBusy;
    b.onclick = async () => {
      opsBusy = true;
      const text = (ownerReportDraft.get(r.id) ?? "").trim();
      const res = await post(`/api/fleet-report/${r.id}/${verdict}`, text ? { reason: text } : {});
      opsBusy = false;
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast(err.error ?? "the verdict did not stick");
      } else ownerReportDraft.delete(r.id);
      await refresh();
      await loadOwnerReports();
    };
    btns.appendChild(b);
  }
  row.appendChild(btns);
  return row;
}

// the read-only twin of opsRow: same facts, no affordance. It carries no acknowledge button because
// the owner is not the principal who could have read the pane text, and the server refuses him here.
function opsUnackedRow(e: OpsPollRow, now: number): HTMLElement {
  const row = el("div", "attnrow uncertain");
  const head = el("div", "attnhead");
  head.appendChild(el("span", "attnkind", e.kind));
  head.appendChild(el("span", "attnprog", opsSubject(e)));
  const since = e.deliveredAt ?? e.createdAt;
  head.appendChild(el("span", "attnmeta", `${opsReceiver(e)} · ${fmtSince(since)} without an ack`));
  row.appendChild(head);
  // THE TWO STATES KNOW DIFFERENT AMOUNTS, so both lines branch, headline and detail alike. A
  // `delivered` row knows tmux took the keystrokes and nothing beyond that. A `send-uncertain` row
  // does not even know that: it is persisted BEFORE tmux is touched, so whether a send was ever
  // accepted is itself unknown. Saying "tmux took the keystrokes" on that row would be a false
  // statement of the one fact this whole class exists to stop overstating.
  const uncertain = e.status === "send-uncertain";
  const secs = Math.round((now - since) / 1000);
  row.appendChild(el("div", "attntext", uncertain
    ? `transport outcome uncertain; recovery ${e.recovery?.state ?? "unavailable"}`
    : "transport reported sent; no session acknowledgement"));
  if (uncertain && e.recovery) {
    row.appendChild(el("div", "shrhint", `state: ${e.recovery.state}`));
    row.appendChild(el("div", "shrhint", `next: ${e.recovery.nextAction}`));
    row.appendChild(el("div", "shrhint", `reason: ${e.recovery.reason}`));
    row.appendChild(el("div", "shrhint", `effect: ${e.recovery.effect}`));
  } else {
    row.appendChild(el("div", "shrhint", uncertain
      ? `Recorded uncertain ${secs}s ago, before Fleet could prove whether tmux accepted anything. The `
        + "text may or may not be in the pane, and no session acknowledgement has arrived either way."
      : `tmux took the keystrokes ${secs}s ago. Whether the session read them is not known — only its `
        + "own acknowledgement can say so, and none has arrived."));
  }
  return row;
}

function renderOpsDlg() {
  opspanel.replaceChildren();
  opspanel.appendChild(el("h2", "", "Operations — completions filed instead of typed into a pane"));
  const live = opsOpenNonReport(opsRows);
  const awaiting = ownerReportRows.filter(ownerReportAwaiting);
  if (!live.length && !awaiting.length && reportsAwaitingOwner === 0)
    opspanel.appendChild(el("div", "shrhint", "Nothing is filed."));
  for (const e of live) opspanel.appendChild(opsRow(e));
  if (reportsAwaitingOwner > 0 || awaiting.length) {
    opspanel.appendChild(el("h2", "", "Worker reports no session can judge — your verdict"));
    opspanel.appendChild(el("div", "shrhint",
      "Either the MAIN each of these was filed to is gone, or none was ever bound — so the acceptance "
      + "door inside a session is closed for good. Accepting or rejecting here is recorded as YOUR "
      + "decision, not as that MAIN's; it moves no task, lands nothing and closes no lane."));
    if (ownerReportErr) opspanel.appendChild(el("div", "shrhint", ownerReportErr));
    else if (!awaiting.length) opspanel.appendChild(el("div", "shrhint", "Loading…"));
    for (const r of awaiting) opspanel.appendChild(ownerReportRowEl(r));
  }
  const now = Date.now();
  const unacked = opsUnacked(opsRows, now);
  if (unacked.length) {
    opspanel.appendChild(el("h2", "",
      "Pane transport without a session acknowledgement — a report, nothing to close"));
    opspanel.appendChild(el("div", "shrhint",
      `Sent into a pane over ${Math.round(PANE_ACK_STALE_MS / 1000)}s ago and still unacknowledged by `
      + "the receiving session. These rows are read-only here: the server-owned recovery state names any next action."));
    for (const e of unacked) opspanel.appendChild(opsUnackedRow(e, now));
  }
  const btns = el("div", "shrbtns");
  const close = el("button", "shrbtn", "close") as HTMLButtonElement;
  close.onclick = closeOpsDlg;
  btns.appendChild(close);
  opspanel.appendChild(btns);
}

opsbtn.onclick = () => {
  setDrawer(false);
  opsdlg.style.display = "flex";
  renderOpsDlg();
  // the rows, never on a timer: the count on the poll is what says whether there is anything to load
  if (reportsAwaitingOwner > 0) void loadOwnerReports();
};
renderOpsBtn();

// --- prompt history: composed sends recorded server-side per slot; recalled via the
// 🕘 popover or ArrowUp/ArrowDown cycling in an (empty) compose box ---
const hist = $("hist"), histList = $("histlist"), histTitle = $("histtitle");
interface HistEntry { text: string; ts: number }

async function fetchHistory(slot: number): Promise<HistEntry[]> {
  const res = await api(`/api/slots/${slot}/history`);
  if (!res.ok) return [];
  const data = (await res.json()) as { history?: HistEntry[] };
  return data.history ?? [];
}

function fmtTs(ts: number): string {
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
let histAll = localStorage.getItem("fleet.histall") === "1";

// one row per prompt; meta = timestamp, plus origin session in the directory view.
// click loads the prompt into the compose box for editing — it never auto-sends
function histRow(text: string, meta: string): HTMLElement {
  const row = el("div", "histrow");
  row.append(el("div", "histtext", text), el("span", "histts", meta));
  const copy = el("span", "histcopy", "⧉");
  copy.title = "copy prompt";
  copy.onclick = (e) => {
    e.stopPropagation();
    copyText(text);
    copy.textContent = "✓";
    setTimeout(() => { copy.textContent = "⧉"; }, 800);
  };
  row.appendChild(copy);
  row.onclick = () => {
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
    localStorage.setItem("fleet.histall", on ? "1" : "0");
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
      histList.appendChild(histRow(p.text, `${origin} · ${fmtTs(p.ts)}`));
    }
  } else {
    const items = await fetchHistory(slot);
    histList.replaceChildren(tabs);
    if (!items.length) histList.appendChild(el("div", "histnone", "nothing sent to this session yet"));
    for (const h of [...items].reverse()) histList.appendChild(histRow(h.text, fmtTs(h.ts)));
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
    const items = (await fetchHistory(slot)).map((h) => h.text);
    if (!items.length) return;
    cyc = { slot, items, idx: items.length, draft: ta.value };
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
function toast(msg: string) {
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
async function deliver(slot: number, text: string): Promise<boolean> {
  try {
    const res = await post("/send", { slot, text, submit: true });
    // 409 is the one failure that is not a failure: the paste may have landed in part or in whole,
    // so the red flash alone would read as "nothing went out" and invite a duplicate send.
    if (res.status === 409) {
      // three 409 shapes since ACP-25, told apart by receipt.delivery: "refused" typed NOTHING (an
      // owner draft occupies the composer — clear or send it first), "uncertain" with
      // acceptance:"not-observed" means the text is OBSERVABLY still in the composer (the pane
      // needs an Enter from the owner, not a second paste), plain "uncertain" is the tmux case.
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
  send.disabled = true;
  try {
    if (!await deliver(slot, outgoing)) return;
    // the send IS the next turn: the counter restarts now, not one transcript poll later
    pane.lastTurnAt = Math.max(pane.lastTurnAt, serverClock());
    tickCacheAge();
    ta.value = "";
    clearAttachments();
    renderAttachments();
    growComposer();
    cyc = null;
    updateChips();
    pane.term.scrollToBottom();
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
function updateChips() {
  const active = currentPrefix();
  for (const b of chipsEl.querySelectorAll<HTMLButtonElement>(".chip"))
    b.classList.toggle("active", b.dataset.cmd === active);
}
function togglePrefix(cmd: string) {
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
const dropBtn = $("dropbtn") as HTMLButtonElement;
const dropFile = $("dropfile") as HTMLInputElement;
const dropLay = $("droplay");
const mainEl = $("main");

// WHAT IS ATTACHED RIGHT NOW. The upload path is unchanged (POST /api/slots/:id/upload, the
// server words the mention); what changed in the third cut is only where the mention is KEPT:
// on this list, shown as an icon with an ✕, instead of as a line the owner has to edit out of the
// box. doSend appends them in upload order, so what leaves the board is the same text as before.
// Ninth cut (owner: "die beigelegten bilder in kleiner darstellung … mit ':1M' … dahinter"): an
// image shows its own bytes as a thumbnail — an object URL over the File the browser already
// holds, no request — and every entry carries its size. The URL is revoked wherever the entry
// leaves the list (✕, send), otherwise every dropped screenshot stays in memory for the tab's life.
const attached: { name: string; mention: string; size: number; thumb?: string }[] = [];

// the owner's ":1M" — bytes in the short form a file list uses: 512B, 820K, 1.4M, 12M
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
      attached.push({ name: f.name, mention: j.mention, size: f.size,
        ...(f.type.startsWith("image/") ? { thumb: URL.createObjectURL(f) } : {}) });
    }
    renderAttachments();
    updateChips();
    ta.focus();
  } finally {
    dropBtn.disabled = false;
  }
}

const dragHasFiles = (e: DragEvent): boolean => Array.from(e.dataTransfer?.types ?? []).includes("Files");
// A file dropped ANYWHERE on the page is, by browser default, a navigation to that file — the
// board would simply disappear. So the page-level default is cancelled everywhere while only
// #main actually accepts a drop; a miss then does nothing instead of destroying the session view.
document.addEventListener("dragover", (e) => { if (dragHasFiles(e)) e.preventDefault(); });
document.addEventListener("drop", (e) => { if (dragHasFiles(e)) e.preventDefault(); });
mainEl.addEventListener("dragover", (e) => {
  if (!dragHasFiles(e)) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
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
buildTray(); // the tray's entries are the functions that used to own an icon button of their own
void (async () => {
  await refresh();
  void loadDispositions(); // so an already-labeled ③ review renders its label, not "unbewertet"
  let view: { layout?: number; panes?: number[]; focused?: number } = {};
  try {
    view = JSON.parse(localStorage.getItem("fleet.view") ?? "{}") as typeof view;
  } catch {
    view = {};
  }
  const legacy = Number(localStorage.getItem("fleet.current"));
  const n = !isMobile() && view.layout && LAYOUTS[String(view.layout)] ? view.layout : 1;
  const assignments = view.panes ?? (legacy ? [legacy] : []);
  if (!assignments.some((s) => s && fleet[s - 1]?.cwd)) {
    const first = fleet.find((s) => s.cwd)?.id;
    if (first) assignments[0] = first;
  }
  setLayout(n, assignments);
  focusPane(Math.min(view.focused ?? 0, n - 1));
  setCollapsed(localStorage.getItem("fleet.sidecollapsed") === "1");
})();
