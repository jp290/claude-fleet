// THE START WINDOW — what the + of a repo, a click on a free place in the bar and ⎇+ on a session
// open. Since 2026-10-10 it is KONZEPT 3 of "Claude Fleet aus einer Idee" (owner bar 07.10.:
// "Startfenster = EINE Wahl Rolle (+ Worktree, wenn die Rolle einen braucht)"; owner finding: „[Zitat entfernt]“
// ). A new session is a new counterpart, so the window asks one
// thing: WHO. Everything else follows as the role's standard and is shown, not asked.
//
// FIRST, WHAT COMES INTO BEING (owner 10.10. at the live board): Session · Branch · Task, one bar at
// the top of the same window — never a second menu.
//   · Session: the role (Lane, MAIN, Orchestratorin, Nur Ordner), then the role's ONE second field
//     (Lane → Worktree, MAIN → Program, Nur Ordner → Ordner, Orchestratorin → only where she runs),
//     then "Was die Session bekommt" as one line with its bytes, and "Anpassen" as a layer of its own.
//   · Branch: a worktree without a session. The server has no door for that yet (createWorktree runs
//     only inside a lane spawn), so the choice stands grey and says what is missing — it never starts
//     a session in secret.
//   · Task: the text is filed as a card over the board's owner route POST /api/tasks, or handed to the
//     running Orchestratorin over POST /send; the window shows the receipt (row id or send receipt).
//
// THE PLAN IS THE SERVER'S. Every word below the role comes from GET /api/founding-plan: the role
// list (`rollen`, with each role's standard triple), the plan (`plan`: hash, planSatz, bytesVorAuftrag,
// one row per Baustein with wort, satz, grenze, zustand, rollenDefault, harness validity, bytes) and
// what the role's door would do with it (`start`). The foot's sentence is planSatz, never composed
// here; the deviations are counted from zustand against rollenDefault; an unknown size stays the word
// "unbekannt", never a 0. A start carries the plan's hash (POST …/open, …/open-worktree, /api/lanes:
// `plan`); a 409 shows the moved plan in the window instead of starting. bootstrap-main takes no plan
// yet, so a MAIN's Bausteine are shown, not switched — the window says so.
//
// Technical facts — ids, bytes per row, sources — stand only behind "Details" (hover on a desktop row,
// the Details switch everywhere). It is a src/shell.ts#openShell window without a list: the shell
// brings the dimmed backdrop and Esc/✕/click-beside closing; Enter outside a control starts.
import {
  agentHarnesses, api, baseName, containerDefaults, defaultModel, el, fleet, harnesses, isMobile,
  laneBandNames, loadHarnesses, modelNotice, post, revealStartedSlot, setDrawer, showSlot, SKEW_NOTE, stacksOf,
  type DirInfoResp, type HarnessInfo, type SlotInfo, type StartResult,
} from "./client";
import { matchTree } from "./filetree";
import { Flakes } from "./flakes";
import { icon } from "./icons";
import { projectHue } from "./marks";
import { modelLabel } from "./modelname";
import { packIdFassung, standSincePreview, type FoundingPlanOmission, type FoundingPlanPack,
  type FoundingPlanPart, type FoundingSessionAgents, type LaneAnchor, type PackAnchors, type PackStand } from "./protocol";
import { openShell, type Shell } from "./shell";
import { dropGrantMount, proofGrantRow } from "./rights";

// the four roles of the register (session-blocks.ts#SessionRole); the server's own word for each
// comes with the plan (`rollen[].wort`), the sentence is the window's (Konzept 3, Blatt 20)
type Role = "lane" | "main" | "orchestratorin" | "nur-ordner";
const ROLE_IDS: readonly Role[] = ["lane", "main", "orchestratorin", "nur-ordner"];
const ROLE_SAY: Record<Role, { word: string; say: string; glyph: Parameters<typeof icon>[0] }> = {
  lane: { word: "Lane", say: "arbeitet einen Auftrag im eigenen Worktree ab", glyph: "branch" },
  main: { word: "MAIN", say: "führt ein Program: schreibt Karten, prüft Reports, landet", glyph: "flag" },
  orchestratorin: { word: "Orchestratorin", say: "beaufsichtigt die MAINs", glyph: "ranke" },
  "nur-ordner": { word: "Nur Ordner", say: "ohne Fleet-Zusätze; lädt den Ordner und sein AGENTS.md", glyph: "folder" },
};
// the place each role's plan is made for (session-blocks.ts#PlanOrt)
const ORT: Record<Role, "worktree" | "repo" | "ordner"> = { lane: "worktree", main: "repo", orchestratorin: "repo", "nur-ordner": "ordner" };
// the label the server keys the Orchestratorin off: isOrchestratorLabel (word boundary)
const ORCH_LABEL = "Orchestrator";

type Kind = "session" | "branch" | "task";
const KINDS: { id: Kind; word: string; glyph: Parameters<typeof icon>[0]; title: string }[] = [
  { id: "session", word: "Session", glyph: "terminal", title: "Neue Session" },
  { id: "branch", word: "Branch", glyph: "branch", title: "Neuer Branch" },
  { id: "task", word: "Task", glyph: "pencil", title: "Neuer Task" },
];
// what the Branch choice is missing, said where the choice stands grey (FAKT, Lane 9B: a worktree
// without a session does not come into being today — createWorktree runs only in the lane spawn)
const BRANCH_MISSING = "Ein Worktree ohne Session entsteht heute nicht: der Server legt einen Worktree nur beim Start einer Lane an.";
const BRANCH_DOOR = "Es fehlt die Server-Tür für einen Worktree ohne Session — bis es sie gibt, steht diese Wahl grau.";

// where the window was opened from: a clicked free place, or ⎇+/the repo's + (its repo and, for ⎇+,
// the session occupant the lane hangs under — never the slot alone, slots recycle)
type Entry = { kind: "slot"; slot: number } | { kind: "lane"; repo: string; parent?: LaneAnchor; from: string };

interface Repo { repo: string; name: string; slots: SlotInfo[] }
// one Baustein of the plan (session-blocks.ts#SessionPlanBaustein), read as the server sent it
type Zustand = string; // "an" | "aus" | "ersetzt:<id>"
interface Baustein {
  id: string; wort: string; satz: string; funktion: string[];
  grenze: { art: "noetig"; grund: string; gesperrt?: true } | { art: "frei" };
  schicht: string; zustand: Zustand; quelle: "default" | "schalter";
  rollenDefault: "an" | "aus" | { zustand: "bedingt"; grund: string };
  bedingung?: { grund: string; erfuellt: boolean | "unknown" };
  harness: { gueltig: boolean; grund: string | null };
  schaltbar: { ja: true } | { ja: false; grund: string };
  bytes: number | "unknown"; enthaltenIn?: string; ersatzKandidaten: string[]; vorlage?: string; details?: unknown;
}
interface SessionPlan {
  planHash: string; planSatz: string; rolle: Role; harness: string; modell: string | null; effort: string | null;
  ort: { art: string; pfad: string; branch: string | null; head: string };
  bytesVorAuftrag: { bytes: number; unknown: string[]; auftrag: string[] };
  bausteine: Baustein[];
}
interface RolleRow { id: Role; wort: string; standard: { harness: string; modell: string; effort: string | null } | null; verfuegbarkeit: string }
// the plan route's answer (shapes: src/protocol.ts#FoundingPlanPack); head and plannedAt are the
// PREVIEW's source state, which the start receipt is later held against
interface Plan {
  head?: string; branch?: string | null; harness?: string; plannedAt?: number; selected: FoundingPlanPack[]; omitted: FoundingPlanOmission[];
  sessionAgents?: FoundingSessionAgents;
}
interface Answer extends Plan {
  plan: SessionPlan; rollen: RolleRow[]; start: { tuer: "lane" | "open"; startbar: boolean; refusals: string[] };
}
interface DirList { path: string; parent: string | null; dirs: string[]; repos?: string[]; capped?: boolean; total?: number }
interface FindHit { path: string; name: string; repo: boolean }
// one Program as the MAIN choice reads it off GET /api/programs. `state` is the server's own
// health.occupancy (the same comparison bootstrap-main's live guard makes); a row whose founding
// marker stands, or that carries no readable occupancy, is "unknown" — never guessed free.
type ProgState = "free" | "stale" | "live" | "unknown";
interface ProgRow { id: string; title: string; state: ProgState; slot: number | null }
type Pop = "place" | "agent" | "model" | "effort" | "container" | "orphan" | `swap:${string}`;
// what a filed task left behind: the queue row, or the send receipt at the Orchestratorin
type TaskReceipt = { kind: "card"; id: string; repo: string } | { kind: "orch"; slot: number; sendId: string; parked: boolean };

interface State {
  shell: Shell;
  flakes: Flakes;
  entry: Entry;
  kind: Kind;
  role: Role;
  layer: "rolle" | "anpassen";
  wt: "new" | "old";                    // a lane's worktree: fresh from the integration branch, or continued
  orphan: string | null;                // the continued worktree
  repos: Repo[];
  view: "repos" | "folders";
  place: string | null;
  info: DirInfoResp | null; infoErr: string | null; infoSeq: number;
  // THE PLAN of this start, and the query it answers; rollen stay from the first answer on
  answer: Answer | null; answerFor: string | null; planErr: string | null; planSeq: number;
  rollen: RolleRow[] | null;
  tripleFor: Role | null;               // the role whose standard triple the fields hold
  harness: string; model: string; effort: string; container: string; containerContext: string;
  switches: Map<string, string>;        // the owner's Baustein switches against the role's defaults
  last: string | null;                  // the switch the owner pressed last — a refused one is taken back
  note: string | null;                  // what the plan refused or moved, said under the field
  moved: string | null;                 // a start answered 409: the plan moved, the window shows the new one
  details: boolean;                     // the Details switch of Anpassen — off at every open, never stored
  progs: ProgRow[] | null; progOther: number; progErr: string | null; progSeq: number;
  program: string | null;               // the Program the MAIN is founded for
  dir: string; list: DirList | null; listErr: string | null; listSeq: number;
  find: string; hits: FindHit[] | null; findPartial: boolean; findSeq: number;
  findTimer: ReturnType<typeof setTimeout> | null;
  paintFolders: (() => void) | null;    // the open folder list repaints alone, so typing keeps focus
  task: { text: string; busy: boolean; receipt: TaskReceipt | null; error: string | null };
  error: string | null;
  busy: boolean;
  proof: StartProof | null;
  pop: Pop | null;
  restore: HTMLElement | null;
  teardown: () => void;
}
let S: State | null = null;

// every button in this window activates on its own Enter; the window's Enter-to-start reads it
function btn(cls: string, text?: string): HTMLButtonElement {
  const b = el("button", cls, text) as HTMLButtonElement;
  b.type = "button";
  b.dataset.ownEnter = "1";
  return b;
}
const tilde = (p: string): string => p.replace(/^\/Users\/[^/]+/, "~").replace(/^\/home\/[^/]+/, "~");
const lab = (text: string): HTMLElement => el("div", "fdlab", text);

// the repos of the running fleet, busiest first, grouped by the canonical toplevel (SlotInfo.repo)
function repoList(): Repo[] {
  const by = new Map<string, Repo>();
  for (const s of fleet) {
    if (!s.cwd) continue;
    const repo = s.repo ?? s.cwd;
    const r = by.get(repo) ?? { repo, name: baseName(repo), slots: [] };
    r.slots.push(s);
    by.set(repo, r);
  }
  return [...by.values()].sort((a, b) => b.slots.length - a.slots.length || a.name.localeCompare(b.name));
}

// the name a session has IN THE BAR: a MAIN is its number, a lane its band name (2A, 2B …) —
// src/client.ts#laneBandNames, the one derivation the bar and the board already share
function barNames(): Map<number, string> { return laneBandNames(stacksOf()); }
const barName = (names: Map<number, string>, s: SlotInfo): string => names.get(s.id) ?? String(s.id);

// the running Orchestratorin, by the role the server gives her (server.ts#positionRole)
const runningOrch = (): SlotInfo | undefined => fleet.find((x) => x.cwd && x.role === "orchestrator");
// a non-lane door needs a free place: the clicked one, or the first free one in the bar
const freePlace = (): number | null => S?.entry.kind === "slot" ? S.entry.slot : fleet.find((x) => !x.cwd)?.id ?? null;

function chosenHarness(): HarnessInfo | null {
  return harnesses.find((h) => h.id === S?.harness) ?? agentHarnesses().find((h) => h.default) ?? null;
}

// --- open / close --------------------------------------------------------------------------------

export function openPicker(slotId: number) {
  open({ kind: "slot", slot: slotId });
}

// ⎇+ on a session, and the + of a repo on the board: the same window, the repo and the Lane role
export function openLaneFounding(repo: string, parent?: LaneAnchor) {
  const names = barNames();
  const from = parent ? fleet.find((x) => x.id === parent.slot) : undefined;
  open({ kind: "lane", repo, parent, from: from ? barName(names, from) : "" });
}

function open(entry: Entry) {
  setDrawer(false);
  closeFounding();
  const restore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const shell = openShell({
    id: "found",
    title: "Neue Session",
    subtitle: entry.kind === "lane"
      ? `${entry.from ? `von ${entry.from} · ` : ""}${baseName(entry.repo)}`
      : `Slot ${entry.slot} · frei`,
    onClose: () => {
      const s = S;
      S = null;
      if (!s) return;
      s.teardown();
      s.flakes.dispose();
      if (s.findTimer) clearTimeout(s.findTimer);
      s.restore?.focus?.();
    },
  });
  shell.root.querySelector(".shellclose")?.replaceChildren(icon("x"));
  const flakes = new Flakes();
  shell.root.querySelector(".shellwin")?.prepend(flakes.canvas);
  flakes.setActive(true);
  // focusable without a tab stop: a click on empty space lands here, and Enter then starts
  shell.detail.tabIndex = -1;
  const repos = repoList();
  S = {
    shell, flakes, entry, kind: "session", role: "lane", layer: "rolle", wt: "new", orphan: null,
    repos, view: repos.length ? "repos" : "folders", place: null,
    info: null, infoErr: null, infoSeq: 0, answer: null, answerFor: null, planErr: null, planSeq: 0,
    rollen: null, tripleFor: null, harness: "", model: "", effort: "", container: "", containerContext: "",
    switches: new Map(), last: null, note: null, moved: null, details: false,
    progs: null, progOther: 0, progErr: null, progSeq: 0, program: null,
    dir: "~", list: null, listErr: null, listSeq: 0, find: "", hits: null, findPartial: false, findSeq: 0,
    findTimer: null, paintFolders: null, task: { text: "", busy: false, receipt: null, error: null },
    error: null, busy: false, proof: null, pop: null, restore, teardown: () => {},
  };
  // the popovers own Escape, the arrows and Enter while one is open. WINDOW capture runs before
  // the shell's document-capture handler, so an Escape here closes the popover and never the window.
  const onKey = (e: KeyboardEvent) => {
    const s = S;
    if (!s) return;
    if (!s.pop) {
      // Esc in Anpassen goes one layer back, never closes the window
      if (e.key === "Escape" && s.layer === "anpassen" && !s.proof) { e.preventDefault(); e.stopPropagation(); setLayer("rolle"); }
      return;
    }
    const pop = s.shell.root.querySelector<HTMLElement>(".fdpop");
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closePop(true); return; }
    if (!pop || !(e.target instanceof Node) || !pop.contains(e.target)) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); e.stopPropagation();
      const rows = [...pop.querySelectorAll<HTMLElement>(".fdprow:not(:disabled)")];
      const i = rows.indexOf(document.activeElement as HTMLElement);
      rows[e.key === "ArrowDown" ? Math.min(i + 1, rows.length - 1) : Math.max(i - 1, 0)]?.focus();
    } else if (e.key === "Enter") {
      // a button activates natively; a free-text field applies its value
      e.stopPropagation();
      if (e.target instanceof HTMLInputElement && e.target.dataset.apply === "1") { e.preventDefault(); e.target.dispatchEvent(new Event("change")); }
    }
  };
  const onDown = (e: PointerEvent) => {
    const s = S;
    if (!s?.pop || !(e.target instanceof Node)) return;
    const pop = s.shell.root.querySelector(".fdpop");
    const sw = s.shell.root.querySelector(`[data-pop="${CSS.escape(s.pop)}"]`);
    if (pop?.contains(e.target) || sw?.contains(e.target)) return;
    closePop(false);
  };
  // Enter outside a control starts — the composer's grammar; ⌘/Ctrl+Enter starts from anywhere.
  // Tab stays inside the window: past the last control it wraps to the first, and back.
  const onWinKey = (e: KeyboardEvent) => {
    const s = S;
    if (!s) return;
    if (e.key === "Tab") {
      const all = [...s.shell.root.querySelectorAll<HTMLElement>("button:not(:disabled), input, textarea, [tabindex='0']")]
        .filter((x) => x.offsetParent !== null && x.tabIndex >= 0);
      const first = all[0], last = all[all.length - 1];
      if (first && last && e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (first && last && !e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      return;
    }
    if (e.key !== "Enter" || e.defaultPrevented || s.pop) return;
    const t = e.target instanceof HTMLElement ? e.target : null;
    // the window is modal: an Enter with the focus nowhere (on body) is still its Enter
    if (t && t !== document.body && !s.shell.root.contains(t)) return;
    const inControl = !!t?.closest("button, input, select, textarea, [contenteditable]");
    if (inControl && !(e.metaKey || e.ctrlKey)) return;
    e.preventDefault();
    e.stopPropagation();
    if (s.kind === "task") void fileTask();
    else if (s.kind === "session") void start();
  };
  window.addEventListener("keydown", onKey, true);
  shell.root.addEventListener("pointerdown", onDown, true);
  // capture: the app's own keyboard (the composer, the panes) must not see an Enter this window took
  window.addEventListener("keydown", onWinKey, true);
  // on a phone a field's popover stands fixed above the foot, and the foot grows with its sentence:
  // the popover reads the foot's real distance from the bottom, never a guess
  const footGap = () => shell.root.style.setProperty("--fdfootgap", `${Math.max(0, Math.round(innerHeight - shell.foot.getBoundingClientRect().top))}px`);
  const footSeen = new ResizeObserver(footGap);
  footSeen.observe(shell.foot);
  window.addEventListener("resize", footGap);
  S.teardown = () => {
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("keydown", onWinKey, true);
    window.removeEventListener("resize", footGap);
    footSeen.disconnect();
  };
  if (entry.kind === "lane") choosePlace(entry.repo);
  else if (repos.length) choosePlace(repos[0]!.repo);
  else { renderAll(); void loadDir("~"); }
  // fetch-once: the catalogue is needed exactly when a start is being composed
  void loadHarnesses().then(() => { if (S) { applyStandard(); renderAll(); } });
  if (!isMobile()) S.shell.foot.querySelector<HTMLElement>(".fdgo")?.focus({ preventScroll: true });
}

export function closeFounding() {
  S?.shell.close();
}

function renderAll() {
  const s = S;
  if (!s) return;
  // after a start the window shows its receipt; the choices are no longer on screen
  if (s.proof) { renderProof(); return; }
  s.shell.setTitle(s.layer === "anpassen" ? "Anpassen" : KINDS.find((k) => k.id === s.kind)!.title);
  keepFocus(() => { renderBody(); renderFoot(); });
}

// A REPAINT THAT ANSWERS LATE (the plan, the Programs) keeps the keyboard where it was: the focused
// control is found again by its data key after the window is rebuilt
const FOCUS_KEYS = ["kind", "role", "row", "pop", "program", "wt", "act"];
function keepFocus(paint: () => void) {
  const a = document.activeElement;
  const key = a instanceof HTMLElement && S?.shell.root.contains(a) ? FOCUS_KEYS.find((k) => a.dataset[k] !== undefined) : undefined;
  const value = key && a instanceof HTMLElement ? a.dataset[key] : undefined;
  paint();
  if (key && value !== undefined && !(document.activeElement instanceof HTMLElement && S?.shell.root.contains(document.activeElement) && document.activeElement !== document.body))
    S?.shell.root.querySelector<HTMLElement>(`[data-${key}="${CSS.escape(value)}"]`)?.focus({ preventScroll: true });
}

// sizes as Konzept 3 says them: kB with one decimal (1 kB = 1000 B), a comma, never an estimate
const kb = (bytes: number): string => `${(bytes / 1000).toFixed(1).replace(".", ",")} kB`;

function renderBody() {
  const s = S!;
  const d = s.shell.detail;
  d.replaceChildren();
  if (s.layer === "anpassen" && s.kind === "session") { d.append(anpassenView()); return; }
  d.append(kindBar());
  if (s.kind === "branch") d.append(branchView());
  else if (s.kind === "task") d.append(taskView());
  else d.append(sessionView());
}

// --- WAS ENTSTEHT: Session · Branch · Task -----------------------------------------------------------

function kindBar(): HTMLElement {
  const s = S!;
  const bar = el("div", "fdkinds");
  bar.setAttribute("role", "radiogroup");
  bar.setAttribute("aria-label", "Was entsteht");
  for (const k of KINDS) {
    const on = s.kind === k.id;
    const b = btn(`fdkind${on ? " on" : ""}${k.id === "branch" ? " grey" : ""}`);
    b.dataset.kind = k.id;
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(on));
    b.append(icon(k.glyph), el("span", "", k.word));
    if (k.id === "branch") b.title = BRANCH_DOOR;
    b.onclick = () => { if (s.kind !== k.id) { s.kind = k.id; s.pop = null; s.error = null; renderAll(); } };
    bar.append(b);
  }
  return bar;
}

function branchView(): HTMLElement {
  const box = el("section", "fdone fdbranchview");
  box.append(lab("Branch ohne Session"));
  const card = el("div", "fdgreycard");
  card.append(icon("branch"), el("div", "fdgreysay", BRANCH_MISSING));
  box.append(card, el("div", "fdsay2", "Bis dahin legt Session → Lane Worktree und Session zusammen an."));
  return box;
}

// --- TASK: filed as a card, or handed to the Orchestratorin --------------------------------------------

function taskView(): HTMLElement {
  const s = S!;
  const box = el("section", "fdone fdtaskview");
  const r = s.task.receipt;
  if (r) {
    box.append(lab(r.kind === "card" ? "Gefilet" : "An die Orchestratorin"));
    const card = el("div", "fdreceipt");
    card.dataset.receipt = r.kind;
    if (r.kind === "card") {
      card.append(icon("check"), el("div", "fdrcol", ""));
      card.lastElementChild!.append(el("div", "fdrhead", `Zeile ${r.id}`),
        el("div", "fdsay2", `als Karte in ${baseName(r.repo)} gefilet, noch nicht freigegeben — sie steht in der Warteschlange.`));
    } else {
      card.append(icon(r.parked ? "clock" : "check"), el("div", "fdrcol", ""));
      card.lastElementChild!.append(el("div", "fdrhead", r.parked ? `Geparkt für Slot ${r.slot}` : `Zugestellt an Slot ${r.slot}`),
        el("div", "fdsay2", r.parked ? "Ihr Eingabefeld war belegt — die Nachricht geht hinein, sobald es frei ist." : "Die Orchestratorin hat die Nachricht in ihrem Gespräch."),
        el("div", "fdmono fdfaint", `Beleg ${r.sendId.slice(0, 12)}`));
    }
    box.append(card);
    return box;
  }
  box.append(lab("Was soll getan werden?"));
  const ta = el("textarea", "fdtask") as HTMLTextAreaElement;
  ta.value = s.task.text;
  ta.rows = 6;
  ta.placeholder = "Ziel in ein, zwei Sätzen — die MAIN oder die Orchestratorin schärft den Rest.";
  ta.oninput = () => { s.task.text = ta.value; s.task.error = null; renderFoot(); };
  box.append(ta);
  box.append(lab("Für"));
  box.append(placeRow());
  if (s.pop === "place") box.append(placePop());
  if (s.task.error) box.append(el("div", "fdnote warn", s.task.error));
  queueMicrotask(() => { if (S === s && s.kind === "task" && !s.pop && document.activeElement !== ta && !s.shell.root.contains(document.activeElement)) ta.focus({ preventScroll: true }); });
  return box;
}

// THE CARD over the board's owner route — the same POST /api/tasks the queue's „[Zitat entfernt]“ sends:
// filed, not released (queue:false), in the chosen repo
async function fileTask() {
  const s = S;
  const text = s?.task.text.trim();
  if (!s || !text || s.task.busy || !s.place) return;
  s.task.busy = true;
  s.task.error = null;
  renderFoot();
  const repo = s.place;
  try {
    const r = await post("/api/tasks", { text, queue: false, repo });
    const j = (await r.json().catch(() => null)) as { task?: { id?: unknown }; error?: string } | null;
    if (S !== s) return;
    if (!r.ok || typeof j?.task?.id !== "string") s.task.error = j?.error ?? `Der Server hat die Karte nicht angenommen (Antwort ${r.status}).`;
    else s.task.receipt = { kind: "card", id: j.task.id, repo };
  } catch (e) {
    if (S === s) s.task.error = `Der Server ist nicht erreichbar: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    if (S === s) { s.task.busy = false; renderAll(); }
  }
}

// THE MESSAGE to the running Orchestratorin over POST /send, pinned to her occupant (openedAt) and
// parked while her composer holds a draft (whenFree) — the receipt is the server's own
async function taskToOrch() {
  const s = S;
  const text = s?.task.text.trim();
  const orch = runningOrch();
  if (!s || !text || s.task.busy || !orch) return;
  s.task.busy = true;
  s.task.error = null;
  renderFoot();
  const where = s.place ? ` für ${baseName(s.place)}` : "";
  try {
    const r = await post("/send", { slot: orch.id, text: `Neuer Auftrag vom Owner (Plus im Board${where}): ${text}`, whenFree: true,
      ...(orch.openedAt ? { openedAt: orch.openedAt } : {}) });
    const j = (await r.json().catch(() => null)) as { receipt?: { sendId?: unknown }; error?: string } | null;
    if (S !== s) return;
    const sendId = j?.receipt?.sendId;
    if (!r.ok || typeof sendId !== "string") s.task.error = j?.error ?? `Die Nachricht kam nicht an (Antwort ${r.status}).`;
    else s.task.receipt = { kind: "orch", slot: orch.id, sendId, parked: r.status === 202 };
  } catch (e) {
    if (S === s) s.task.error = `Der Server ist nicht erreichbar: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    if (S === s) { s.task.busy = false; renderAll(); }
  }
}

// --- SESSION: the role, its second field, what the session gets ----------------------------------------

function sessionView(): HTMLElement {
  const s = S!;
  const cols = el("div", "fdk3");
  const left = el("section", "fdcol fdcolroles");
  left.append(lab("Rolle"), roleList());
  const right = el("section", "fdcol fdcolsecond");
  right.append(...secondField());
  right.append(lab("Was die Session bekommt"), getsRow());
  if (s.note) right.append(el("div", "fdnote warn", s.note));
  cols.append(left, right);
  if (needsPlan() && s.answerFor !== planKey()) void loadPlan();
  return cols;
}

// the role list: the server's rollen when it sent them, else the register's four in their order
function roles(): RolleRow[] {
  const s = S!;
  return s.rollen ?? ROLE_IDS.map((id) => ({ id, wort: ROLE_SAY[id].word, standard: null, verfuegbarkeit: "unknown" }));
}

// a role's standard in words: agent · model, as the register names them
function standardSay(r: RolleRow): string {
  if (!r.standard) {
    const h = agentHarnesses().find((x) => x.default);
    return h ? harnessWord(h.id) : "";
  }
  return [harnessWord(r.standard.harness), modelLabel(r.standard.modell).replace(/ · .*$/, "")].join(" · ");
}
const harnessWord = (id: string): string => id ? id.charAt(0).toUpperCase() + id.slice(1) : "";

function roleList(): HTMLElement {
  const s = S!;
  const list = el("div", "fdroles");
  list.setAttribute("role", "radiogroup");
  list.setAttribute("aria-label", "Rolle");
  const orch = runningOrch();
  const laneOnly = s.entry.kind === "lane" && !!s.entry.parent;
  for (const r of roles()) {
    const on = s.role === r.id;
    const say = ROLE_SAY[r.id];
    const b = btn(`fdrr${on ? " on" : ""}`);
    b.dataset.role = r.id;
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(on));
    const text = el("span", "fdrt");
    text.append(el("span", "fdrn", r.wort));
    // the Orchestratorin exists once: her row stands grey and switches to her instead of founding a second
    if (r.id === "orchestratorin" && orch) {
      b.classList.add("grey");
      b.setAttribute("aria-disabled", "true");
      text.append(el("span", "fdrs", `${say.say} · läuft schon, Slot ${orch.id}`));
      b.append(el("span", "fdglyph", ""), text, el("span", "fdrm", "wechseln ›"));
      b.querySelector(".fdglyph")!.append(icon(say.glyph));
      b.title = `Zur laufenden Orchestratorin auf Slot ${orch.id} wechseln — eine zweite wird nicht gegründet.`;
      b.onclick = () => { closeFounding(); showSlot(orch.id); };
      list.append(b);
      continue;
    }
    text.append(el("span", "fdrs", say.say));
    const glyph = el("span", "fdglyph");
    glyph.append(icon(say.glyph));
    const unavailable = r.verfuegbarkeit === "unavailable";
    b.append(glyph, text, el("span", "fdrm", unavailable ? "Standard läuft hier nicht" : standardSay(r)));
    // ⎇+ under a session founds a lane under it: the other roles are a free place's
    if (laneOnly && r.id !== "lane") {
      b.disabled = true;
      b.title = "⎇+ hängt eine Lane an diese Session — andere Rollen über das + des Repos oder einen freien Platz.";
    }
    b.onclick = () => setRole(r.id);
    list.append(b);
  }
  return list;
}

function setRole(r: Role) {
  const s = S;
  if (!s || s.role === r) return;
  s.role = r;
  s.error = null;
  s.note = null;
  s.moved = null;
  s.switches.clear();
  s.last = null;
  applyStandard();
  renderAll();
  if (r === "main") void loadProgs();
}

// THE ROLE'S STANDARD (model-register.ts#MODEL_DEFAULTS, served as `rollen[].standard`) fills Agent,
// Modell and Effort — only what this machine's agent supports, and an agent that does not run here
// fills the default agent with the adapter's own choice. Read once the plan has named it.
function standardOf(r: Role): { harness: string; model: string; effort: string } {
  const def = agentHarnesses().find((h) => h.default)?.id ?? "";
  const row = S?.rollen?.find((x) => x.id === r);
  const want = row?.standard;
  const h = want ? agentHarnesses().find((a) => a.id === want.harness) : undefined;
  if (!want || !h || row?.verfuegbarkeit === "unavailable") return { harness: def, model: "", effort: "" };
  return { harness: h.id, model: h.supports.model ? want.modell : "",
    effort: h.supports.effort && want.effort && h.effortLevels.includes(want.effort) ? want.effort : "" };
}
function applyStandard() {
  const s = S;
  if (!s?.rollen || !agentHarnesses().length) return;
  const std = standardOf(s.role);
  s.harness = std.harness; s.model = std.model; s.effort = std.effort;
  s.container = ""; s.containerContext = "";
  s.tripleFor = s.role;
}

// THE ROLE'S SECOND FIELD — only the one the role needs (Konzept 3, Blatt 20 §2)
function secondField(): HTMLElement[] {
  const s = S!;
  const out: HTMLElement[] = [];
  const head = (word: string): HTMLElement => {
    const h = el("div", "fdlabrow");
    h.append(el("span", "fdlab", word), placeSwitch());
    return h;
  };
  if (s.role === "lane") {
    out.push(head("Worktree"));
    const list = el("div", "fdopts");
    list.setAttribute("role", "radiogroup");
    list.setAttribute("aria-label", "Worktree");
    const base = s.answer?.branch ?? s.info?.branch ?? null;
    const fresh = btn(`fdopt${s.wt === "new" ? " on" : ""}`);
    fresh.dataset.wt = "new";
    fresh.setAttribute("role", "radio");
    fresh.setAttribute("aria-checked", String(s.wt === "new"));
    const fw = el("span", "fdoptw");
    fw.append(document.createTextNode("Neu aus "), el("span", "fdmono", base ?? "dem Integrationsbranch"));
    fresh.append(fw);
    if (s.wt === "new") fresh.append(icon("check"));
    fresh.onclick = () => { s.wt = "new"; s.orphan = null; s.error = null; renderAll(); };
    const orphans = s.info?.orphans ?? [];
    const cont = btn(`fdopt${s.wt === "old" ? " on" : ""}`);
    cont.dataset.wt = "old";
    cont.dataset.pop = "orphan";
    cont.setAttribute("role", "radio");
    cont.setAttribute("aria-checked", String(s.wt === "old"));
    cont.setAttribute("aria-expanded", String(s.pop === "orphan"));
    const chosen = orphans.find((o) => o.path === s.orphan);
    const cw = el("span", "fdoptw dim");
    cw.append(document.createTextNode("Fortsetzen"));
    if (chosen) cw.append(document.createTextNode(": "), el("span", "fdmono ink", chosen.branch || baseName(chosen.path)));
    else cw.append(document.createTextNode(orphans.length ? ` · ${orphans.length} ${orphans.length === 1 ? "liegt" : "liegen"} brach` : " · keiner liegt brach"));
    cont.append(cw, icon("chevron"));
    cont.disabled = !orphans.length;
    cont.title = orphans.length ? "Einen liegengebliebenen Worktree weiterführen — die Arbeit darauf bleibt." : "Jeder Worktree dieses Repos hat eine Session.";
    cont.onclick = () => togglePop("orphan");
    list.append(fresh, cont);
    if (s.pop === "orphan") list.append(orphanPop());
    out.push(list);
  } else if (s.role === "main") {
    out.push(head("Program"), progList());
  } else if (s.role === "nur-ordner") {
    out.push(lab("Ordner"), placeRow());
  } else {
    // the Orchestratorin needs nothing more than where she runs
    out.push(head("Ort"));
  }
  if (s.pop === "place" && s.role !== "nur-ordner") out.splice(1, 0, placePop());
  if (s.pop === "place" && s.role === "nur-ordner") out.push(placePop());
  if (s.infoErr) out.push(el("div", "fdnote warn", s.infoErr));
  return out;
}

function orphanPop(): HTMLElement {
  const s = S!;
  const pop = el("div", "fdpop");
  for (const o of s.info?.orphans ?? []) {
    const r = btn(`fdprow${s.orphan === o.path ? " on" : ""}`);
    r.append(el("span", "fdprn fdmono", o.branch || "ohne Branch"), el("span", "fdmeta", baseName(o.path)));
    r.onclick = () => { s.wt = "old"; s.orphan = o.path; s.error = null; closePop(true); };
    pop.append(r);
  }
  return pop;
}

// the place as an option bar (G4.3): its name and a chevron; the popover lists the fleet's repos or
// any folder on this machine
function placeSwitch(): HTMLElement {
  const s = S!;
  const b = btn("fdplaceswitch");
  b.dataset.pop = "place";
  b.setAttribute("aria-expanded", String(s.pop === "place"));
  const laneFixed = s.entry.kind === "lane" && !!s.entry.parent;
  b.disabled = laneFixed;
  b.title = laneFixed ? "⎇+ startet die Lane im Repo der Session, an der es hängt." : "Ort wechseln — Repos mit Sessions oder jeder Ordner auf diesem Rechner.";
  const dot = el("i", "fddot");
  if (s.place) dot.style.setProperty("--proj-h", String(projectHue(s.place)));
  b.append(el("span", "fdfaint", "in"), dot, el("span", "", s.place ? baseName(s.place) || s.place : "Ort wählen"));
  if (!laneFixed) b.append(icon("chevron"));
  b.onclick = () => togglePop("place");
  return b;
}
// the place as a whole row (Nur Ordner, Task): name, path and what the folder is
function placeRow(): HTMLElement {
  const s = S!;
  const b = btn("fdopt fdplacerow");
  b.dataset.pop = "place";
  b.setAttribute("aria-expanded", String(s.pop === "place"));
  const dot = el("i", "fddot");
  if (s.place) dot.style.setProperty("--proj-h", String(projectHue(s.place)));
  const names = el("span", "fdoptw fdpn");
  names.append(el("span", "", s.place ? baseName(s.place) || s.place : "Ort wählen"),
    el("span", "fdmono fdfaint", s.place ? tilde(s.place) : "noch nichts gewählt"));
  const facts = el("span", "fdfaint", !s.info ? (s.place ? "liest …" : "") : !s.info.git ? "kein Git-Repo" : s.info.branch ?? "ohne Branch");
  b.append(dot, names, facts, icon("chevron"));
  b.onclick = () => togglePop("place");
  return b;
}

// THE ONE LINE "Was die Session bekommt": the required Bausteine in owner words, the bytes before the
// Auftrag (bytesVorAuftrag; "unbekannt" as a word), and Anpassen as a layer of its own
function getsRow(): HTMLElement {
  const s = S!;
  if (s.role === "lane" && s.wt === "old") return el("div", "fdsay2 fdgetsnone", "Ein fortgesetzter Worktree behält, was er hat — er startet ohne neuen Plan.");
  const b = btn("fdopt fdgets");
  b.dataset.act = "anpassen";
  const a = fresh();
  const words = el("span", "fdoptw fdpn");
  if (!a) {
    words.append(el("span", "", s.planErr ? "Plan nicht lesbar" : "Plan wird gelesen …"), el("span", "fdsay2", s.planErr ?? ""));
    b.disabled = true;
  } else {
    words.append(el("span", "", getsWords(a.plan)), el("span", "fdsay2", getsBytes(a.plan)));
  }
  const dev = deviations();
  const right = el("span", "fdrm");
  if (dev.length) right.append(el("i", "fddot2"));
  right.append(document.createTextNode("Anpassen"));
  b.append(words, right, icon("chevron"));
  b.title = "Agent, Modell, Effort und die Bausteine dieser Session — gilt nur für diese Session.";
  b.onclick = () => setLayer("anpassen");
  return b;
}
// the words of what binds the session: every required Baustein that is on, in register order, once
function getsWords(p: SessionPlan): string {
  const words: string[] = [];
  for (const b of p.bausteine) if (b.zustand === "an" && b.grenze.art === "noetig" && b.id !== "spawn-profile" && !words.includes(b.wort)) words.push(b.wort);
  return words.length ? words.join(" · ") : "nur was der Ordner selbst lädt";
}
function getsBytes(p: SessionPlan): string {
  const v = p.bytesVorAuftrag;
  const extra = p.bausteine.filter((b) => b.zustand === "an" && b.grenze.art === "frei" && b.id !== "spawn-profile").length;
  const unknown = v.unknown.length ? `${v.unknown.length} ${v.unknown.length === 1 ? "Größe" : "Größen"} unbekannt` : "";
  const size = v.bytes > 0 ? `${kb(v.bytes)} ${v.auftrag.length ? "vor dem Auftrag" : "beim Start"}` : v.unknown.length ? "Größe unbekannt" : `${kb(0)} beim Start`;
  return [size, v.bytes > 0 ? unknown : "", extra ? `${extra} weitere an` : ""].filter(Boolean).join(" · ");
}

function setLayer(l: "rolle" | "anpassen") {
  const s = S;
  if (!s) return;
  s.layer = l;
  s.pop = null;
  renderAll();
  s.shell.detail.scrollTop = 0;
  const target = l === "anpassen" ? ".fdback" : '[data-act="anpassen"]';
  s.shell.root.querySelector<HTMLElement>(target)?.focus({ preventScroll: true });
}

// --- ANPASSEN: one layer deeper, for this session only (Konzept 3, Blatt 21) ---------------------------

function anpassenView(): HTMLElement {
  const s = S!;
  const box = el("section", "fdone fdanpassen");
  const head = el("div", "fdlayerhead");
  const back = btn("fdback");
  back.append(el("span", "fdchevl", ""), el("span", "", KINDS[0]!.title));
  back.querySelector(".fdchevl")!.append(icon("chevron"));
  back.title = "Zurück zur Rolle";
  back.onclick = () => setLayer("rolle");
  const reset = btn("fdghost", "Zurücksetzen");
  reset.dataset.act = "reset";
  reset.disabled = deviations().length === 0;
  reset.title = "Agent, Modell, Effort und jeden Baustein zurück auf den Standard der Rolle.";
  reset.onclick = resetAll;
  head.append(back, reset);
  box.append(head, el("div", "fdsay2", `${ROLE_SAY[s.role].word} · gilt nur für diese Session`));
  box.append(lab("Agent · Modell · Effort"), tripleBars());
  const a = fresh();
  const top = el("div", "fdlabrow");
  top.append(el("span", "fdlab", "Bausteine"));
  const det = btn(`fdghost fddetb${s.details ? " on" : ""}`, "Details");
  det.dataset.act = "details";
  det.setAttribute("aria-pressed", String(s.details));
  det.title = "Ids, Größen und Quellen jeder Zeile zeigen";
  det.onclick = () => { s.details = !s.details; renderAll(); };
  top.append(det);
  box.append(top);
  if (s.role === "main") box.append(el("div", "fdnote", "Die MAIN-Tür (bootstrap-main) baut ihren Plan selbst und nimmt noch keine Schalter — hier steht, was sie bekommt."));
  if (s.note) box.append(el("div", "fdnote warn", s.note));
  if (!a) { box.append(el("div", "fdnote", s.planErr ?? "Plan wird gelesen …")); if (needsPlan() && s.answerFor !== planKey()) void loadPlan(); return box; }
  box.classList.toggle("fdshowdet", s.details);
  box.append(bausteinList(a));
  return box;
}

// Agent · Modell · Effort as three option bars (G4.3): value + chevron, the popover above the bar
function tripleBars(): HTMLElement {
  const s = S!;
  const row = el("div", "fdbars");
  const h = chosenHarness();
  const std = standardOf(s.role);
  const bar = (which: Pop, value: string, dim: boolean, changed: boolean, enabled: boolean): HTMLElement => {
    const w = el("div", "fdbarw");
    const b = btn(`fdbar${dim ? " dim" : ""}${s.pop === which ? " open" : ""}`);
    b.dataset.pop = which;
    b.setAttribute("aria-expanded", String(s.pop === which));
    b.disabled = !enabled;
    if (changed) b.append(el("i", "fddot2"));
    b.append(el("span", "fdbarv", value), icon("chevron"));
    b.onclick = () => togglePop(which);
    w.append(b);
    if (s.pop === which) w.append(popBody(which));
    return w;
  };
  row.append(bar("agent", h ? harnessWord(h.id) : "…", false, s.harness !== std.harness, !!h));
  row.append(bar("model", s.model ? modelLabel(s.model).replace(/ · .*$/, "") : h ? modelShown(h) : "—", !s.model, s.model !== std.model, !!h?.supports.model));
  row.append(bar("effort", s.effort ? effortWord(s.effort) : "Adapter", !s.effort, s.effort !== std.effort, !!h?.supports.effort && !!h.effortLevels.length));
  if (h?.supports.container && s.role !== "main") row.append(bar("container", s.container || containerDefaults?.container || "Fleet-Standard", !s.container, !!(s.container || s.containerContext), true));
  return row;
}
const EFFORT_WORD: Record<string, string> = { low: "niedrig", medium: "mittel", high: "hoch", xhigh: "sehr hoch", max: "maximal" };
const effortWord = (e: string): string => EFFORT_WORD[e] ?? e;

// the rows of Anpassen, flat (Konzept 3: an / aus / ersetzen; nötig carries a lock, no switch): what
// the role has or could take; a row the role never carries and nobody can switch on stays out
function bausteinList(a: Answer): HTMLElement {
  const list = el("div", "fdbaus");
  const order = new Map(GROUPS.map((g, i) => [g.id, i]));
  const groupIdx = (b: Baustein): number => order.get(a.selected.find((p) => `pack:${p.id}` === b.id)?.group ?? "") ?? GROUPS.length;
  const shown = a.plan.bausteine.filter((b) => b.id !== "spawn-profile" && (b.zustand !== "aus" || defaultState(b) === "an"
    || b.rollenDefault !== "aus" || (b.grenze.art === "frei" && b.schaltbar.ja && b.harness.gueltig && !packOmitted(a, b))));
  const plain = shown.filter((b) => !b.id.startsWith("pack:"));
  const packs = shown.filter((b) => b.id.startsWith("pack:")).sort((x, y) => groupIdx(x) - groupIdx(y));
  // rows that share an owner word and are all fixed are ONE row (Rückweg und Ende is three ids)
  const groups: Baustein[][] = [];
  for (const b of [...plain, ...packs]) {
    const prev = groups[groups.length - 1];
    if (prev && prev[0]!.wort === b.wort && fixedRow(a, prev[0]!) && fixedRow(a, b)) prev.push(b);
    else groups.push([b]);
  }
  for (const g of groups) list.append(bausteinRow(a, g));
  if (!groups.length) list.append(el("div", "fdnote", "Diese Rolle bekommt keine Fleet-Bausteine."));
  return list;
}

// a row the owner cannot switch: required, locked, loaded natively, or not for this agent/role/door
function fixedRow(a: Answer, b: Baustein): boolean {
  return S?.role === "main" || b.grenze.art === "noetig" || !b.schaltbar.ja || !b.harness.gueltig || !!packOmitted(a, b);
}
const packOmitted = (a: Answer, b: Baustein): FoundingPlanOmission | undefined =>
  b.id.startsWith("pack:") ? a.omitted.find((o) => `pack:${o.id}` === b.id) : undefined;

// a row's default under this role: what the plan resolves it to before any switch
function defaultState(b: Baustein): "an" | "aus" {
  if (!b.harness.gueltig) return "aus";
  if (typeof b.rollenDefault === "object") return b.bedingung?.erfuellt === false ? "aus" : "an";
  return b.rollenDefault;
}

function bausteinRow(a: Answer, g: Baustein[]): HTMLElement {
  const s = S!;
  const b = g[0]!;
  const row = el("div", `fdbrow${g.some((x) => x.quelle === "schalter" && x.zustand !== defaultState(x)) ? " dev" : ""}`);
  row.dataset.row = b.id;
  const tx = el("div", "fdbtx");
  const name = b.id.startsWith("pack:") ? `Pack · ${PACK_WORDS[b.id.slice(5)]?.name ?? b.id.slice(5)}` : b.wort;
  tx.append(el("div", "fdbn", name), el("div", "fdbs", g.length > 1 ? g.map((x) => x.satz).join(" ") : rowSay(a, b)));
  const det = el("div", "fdbdet");
  for (const x of g) det.append(el("div", "", detailLine(a, x)));
  tx.append(det);
  row.append(tx);
  const omitted = packOmitted(a, b);
  const control = el("div", "fdbc");
  if (!b.harness.gueltig) control.append(el("span", "fdfaint", `nicht für ${harnessWord(s.harness)}`));
  else if (omitted) control.append(el("span", "fdfaint", OMIT_SAY[omitted.reason] ?? omitted.reason));
  else if (b.grenze.art === "noetig") {
    const swap = b.zustand.startsWith("ersetzt:") || (b.ersatzKandidaten.length > 0 && !b.grenze.gesperrt && s.role !== "main");
    if (swap && g.length === 1) {
      const sw = btn("fdswap");
      sw.dataset.pop = `swap:${b.id}`;
      sw.setAttribute("aria-expanded", String(s.pop === `swap:${b.id}`));
      const by = b.zustand.startsWith("ersetzt:") ? a.plan.bausteine.find((x) => x.id === b.zustand.slice(8)) : undefined;
      sw.append(el("span", "", by ? `ersetzt durch ${by.wort}` : "nötig · ersetzen"), icon("chevron"));
      sw.onclick = () => togglePop(`swap:${b.id}`);
      control.append(sw);
      if (s.pop === `swap:${b.id}`) control.append(swapPop(a, b));
    } else {
      control.append(el("span", "fdfaint", "nötig"), icon("shield"));
      control.title = b.grenze.grund;
    }
  } else if (!b.schaltbar.ja || s.role === "main") {
    control.append(el("span", "fdfaint", !b.schaltbar.ja && b.schaltbar.grund.startsWith("Der Harness") || b.id === "auto-memory" ? "lädt nativ"
      : b.zustand === "an" ? "dabei" : "nicht dabei"));
    control.title = b.schaltbar.ja ? "Die MAIN-Tür nimmt keine Schalter." : b.schaltbar.grund;
  } else {
    const on = b.zustand === "an";
    const sw = btn(`fdsw ${on ? "on" : "off"}`);
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-checked", String(on));
    sw.setAttribute("aria-label", name);
    sw.dataset.row = `${b.id}:sw`;
    sw.onclick = () => flip(b.id, on ? "aus" : "an", defaultState(b));
    control.append(sw);
  }
  row.append(control);
  return row;
}

// the row's sentence: the register's, or the reason it is off where that says more
function rowSay(a: Answer, b: Baustein): string {
  if (b.bedingung && b.bedingung.erfuellt === false) return `${b.satz} Nur wenn: ${b.bedingung.grund}.`;
  if (b.id.startsWith("pack:")) return PACK_WORDS[b.id.slice(5)]?.say ?? a.selected.find((p) => `pack:${p.id}` === b.id)?.useWhen ?? b.satz;
  return b.satz;
}

// DETAILS: id, size, where it lives, and the version where the plan names one
function detailLine(a: Answer, b: Baustein): string {
  const size = b.bytes === "unknown" ? "Größe unbekannt" : `${b.bytes.toLocaleString("de-DE")} B`;
  const pack = a.selected.find((p) => `pack:${p.id}` === b.id);
  const fassung = pack ? (pack.sourceHash ? `Fassung ${pack.sourceHash.slice(0, 8)}` : fassungSay(pack.id)) : "";
  const parts = pack?.parts?.map((x) => partFixed(x) ?? "").filter(Boolean) ?? [];
  return [b.id, size, b.enthaltenIn ? `steckt in ${b.enthaltenIn}` : "", b.schicht, fassung,
    b.harness.grund ?? "", b.schaltbar.ja ? "" : b.schaltbar.grund, ...parts].filter(Boolean).join(" · ");
}

function swapPop(a: Answer, b: Baustein): HTMLElement {
  const pop = el("div", "fdpop");
  const keep = btn(`fdprow${b.zustand === "an" ? " on" : ""}`);
  keep.append(el("span", "fdprn", `${b.wort} behalten`));
  keep.onclick = () => { closePop(false); flip(b.id, "an", "an"); };
  pop.append(keep);
  for (const id of b.ersatzKandidaten) {
    const c = a.plan.bausteine.find((x) => x.id === id);
    const r = btn(`fdprow${b.zustand === `ersetzt:${id}` ? " on" : ""}`);
    r.append(el("span", "fdprn", `ersetzen durch ${c?.wort ?? id}`), el("span", "fdmeta", c?.satz ?? id));
    r.onclick = () => { closePop(false); flip(b.id, `ersetzt:${id}`, "an"); };
    pop.append(r);
  }
  return pop;
}

// ONE SWITCH of a row: kept only while it differs from the role's default; the plan is read again
function flip(id: string, to: string, def: string) {
  const s = S;
  if (!s) return;
  if (to === def) s.switches.delete(id); else s.switches.set(id, to);
  s.last = id;
  s.note = null;
  s.moved = null;
  s.error = null;
  renderAll();
}

function resetAll() {
  const s = S;
  if (!s) return;
  s.switches.clear();
  s.last = null;
  s.note = null;
  applyStandard();
  renderAll();
}

// EVERY DEVIATION from the role's standard, in words: the triple against `rollen[].standard`, and
// every row the owner switched whose zustand is off its rollenDefault
function deviations(): string[] {
  const s = S!;
  const out: string[] = [];
  if (s.tripleFor === s.role) {
    const std = standardOf(s.role);
    if (s.harness !== std.harness) out.push(`Agent ${harnessWord(s.harness)}`);
    if (s.model !== std.model) out.push(`Modell ${s.model ? modelLabel(s.model) : "Adapter wählt"}`);
    if (s.effort !== std.effort) out.push(`Effort ${s.effort ? effortWord(s.effort) : "Adapter"}`);
  }
  if (s.container || s.containerContext) out.push(`Container ${s.container || s.containerContext}`);
  const a = fresh();
  if (a) for (const b of a.plan.bausteine) if (b.quelle === "schalter" && b.zustand !== defaultState(b)) out.push(`${b.wort} ${b.zustand}`);
  return out;
}

// --- popovers -----------------------------------------------------------------------------------------

function popRow(label: string, sub: string, on: boolean, pick: () => void): HTMLButtonElement {
  const r = btn(`fdprow${on ? " on" : ""}`);
  r.append(el("span", "fdprn", label));
  if (sub) r.append(el("span", "fdmeta", sub));
  r.onclick = () => { pick(); closePop(true); };
  return r;
}

function popBody(which: Pop): HTMLElement {
  const s = S!;
  const pop = el("div", "fdpop");
  const h = chosenHarness();
  if (which === "agent") {
    for (const a of agentHarnesses()) {
      const sub = [a.default ? "Standard dieses Rechners" : "", a.allowsLanes === false ? "keine Lanes" : ""].filter(Boolean).join(" · ");
      pop.append(popRow(harnessWord(a.id), sub, s.harness === a.id, () => pickHarness(a)));
    }
  } else if (which === "model" && h) {
    pop.append(popRow(modelShown(h), "ohne Angabe", s.model === "", () => { s.model = ""; }));
    for (const m of h.models ?? []) if (m) {
      // two ids can share a display name, so the row carries the id under the name
      const said = modelNotice(h.id, m).replace(/^superseded/, "abgelöst");
      pop.append(popRow(modelLabel(m), said ? `${m} · ${said}` : m, s.model === m, () => { s.model = m; }));
    }
    const w = el("label", "fdpin");
    w.append(el("span", "", "Eigener Wert"));
    const inp = el("input", "") as HTMLInputElement;
    inp.type = "text";
    inp.spellcheck = false;
    inp.autocomplete = "off";
    inp.value = s.model;
    inp.placeholder = "genau so, wie der Adapter ihn liest";
    inp.dataset.apply = "1";
    inp.onchange = () => { s.model = inp.value.trim(); closePop(true); };
    w.append(inp);
    pop.append(w);
  } else if (which === "effort" && h) {
    pop.append(popRow("Adapter", "ohne Angabe", s.effort === "", () => { s.effort = ""; }));
    for (const lv of h.effortLevels) pop.append(popRow(effortWord(lv), lv, s.effort === lv, () => { s.effort = lv; }));
  } else if (which === "container") {
    const field = (label: string, v: string, ph: string, set: (x: string) => void, tip: string) => {
      const w = el("label", "fdpin");
      w.append(el("span", "", label));
      const inp = el("input", "") as HTMLInputElement;
      inp.type = "text";
      inp.spellcheck = false;
      inp.autocomplete = "off";
      inp.value = v;
      inp.placeholder = ph;
      inp.title = tip;
      inp.oninput = () => { set(inp.value.trim()); renderFoot(); };
      w.append(inp);
      return w;
    };
    pop.append(
      field("Container", s.container, containerDefaults?.container ?? "", (x) => { s.container = x; },
        "In welchem Container die Session läuft — leer heißt der Fleet-Standard."),
      field("Docker-Daemon", s.containerContext, containerDefaults?.containerContext ?? "", (x) => { s.containerContext = x; },
        "Auf welchem Docker-Daemon der Container läuft — ein Image lebt in genau einem (intern: docker context)."),
    );
  }
  return pop;
}

// the model a start without a model value gets: the catalogue names it for the default adapter
// only (server.ts DEFAULT_MODEL); elsewhere the adapter decides, and the field says who
function modelShown(h: HarnessInfo): string {
  if (h.default && defaultModel) return modelLabel(defaultModel).replace(/ · .*$/, "");
  return "Adapter wählt";
}

// the agent switch: what belongs to the agent being left never rides along to the next one
function pickHarness(a: HarnessInfo) {
  const s = S!;
  s.harness = a.id;
  if (!a.supports.model || (s.model && !(a.models ?? []).includes(s.model))) s.model = "";
  if (!a.supports.effort || !a.effortLevels.includes(s.effort)) s.effort = "";
  if (!a.supports.container) { s.container = ""; s.containerContext = ""; }
  s.error = null;
  s.moved = null;
}

function togglePop(which: Pop) {
  const s = S;
  if (!s) return;
  s.pop = s.pop === which ? null : which;
  if (which === "place" && s.pop) s.view = s.view === "folders" && s.list ? "folders" : s.repos.length ? "repos" : "folders";
  renderAll();
  if (s.pop) focusPop();
}

function closePop(refocus: boolean) {
  const s = S;
  if (!s?.pop) return;
  const which = s.pop;
  s.pop = null;
  renderAll();
  if (refocus) s.shell.root.querySelector<HTMLElement>(`[data-pop="${CSS.escape(which)}"]`)?.focus();
}

function focusPop() {
  const s = S;
  if (!s) return;
  s.shell.root.querySelector<HTMLElement>(".fdpop input.fdfind, .fdpop .fdprow.on, .fdpop .fdprow, .fdpop input")?.focus({ preventScroll: true });
}

// the place popover: the fleet's repos, or the folder browser over /api/dirs — the same field,
// never a second window
function placePop(): HTMLElement {
  const s = S!;
  const pop = el("div", "fdpop fdplacepop");
  if (s.view === "repos") {
    const bn = barNames();
    for (const r of s.repos) {
      const row = btn(`fdprow${r.repo === s.place ? " on" : ""}`);
      const dot = el("i", "fddot");
      dot.style.setProperty("--proj-h", String(projectHue(r.repo)));
      const who = r.slots.map((x) => barName(bn, x));
      row.append(dot, el("span", "fdprn", r.name), el("span", "fdmeta", tilde(r.repo)),
        el("span", "fdprr fdmono", who.length > 4 ? `${who.slice(0, 4).join(" ")} +${who.length - 4}` : who.join(" ")));
      row.title = `${r.slots.length} Session${r.slots.length === 1 ? "" : "s"} in ${tilde(r.repo)}`;
      row.onclick = () => { closePop(false); choosePlace(r.repo); };
      pop.append(row);
    }
    const other = btn("fdprow fdother");
    other.append(icon("folder"), el("span", "", "Anderer Ordner …"), el("span", "fdmeta", "jeder Ordner auf diesem Rechner"));
    other.onclick = () => { s.view = "folders"; void loadDir(s.dir); };
    pop.append(other);
    return pop;
  }
  const nav = el("div", "fdnav");
  if (s.repos.length) {
    const back = btn("fdnavb", "‹ Repos");
    back.title = "Zurück zu den Repos mit laufenden Sessions.";
    back.onclick = () => { s.view = "repos"; s.find = ""; s.hits = null; renderAll(); focusPop(); };
    nav.append(back);
  }
  const up = btn("fdnavb", "↑");
  up.title = "Eine Ebene höher.";
  up.disabled = !s.list?.parent;
  up.onclick = () => { if (s.list?.parent) void loadDir(s.list.parent); };
  nav.append(up, el("span", "fdcwd fdmono", tilde(s.list?.path ?? s.dir)));
  if (s.list) {
    const here = btn("fdnavb fdhereb", "Hier");
    here.title = `Diesen Ordner wählen: ${tilde(s.list.path)}`;
    here.onclick = () => { const p = s.list!.path; closePop(false); choosePlace(p); };
    nav.append(here);
  }
  const find = el("input", "fdfind") as HTMLInputElement;
  find.type = "text";
  find.placeholder = "Ordner suchen …";
  find.spellcheck = false;
  find.autocomplete = "off";
  find.value = s.find;
  find.oninput = () => { s.find = find.value; scheduleFind(); paintFolders(); };
  const rows = el("div", "fdfolders");
  pop.append(nav, find, rows);
  const add = (path: string, name: string, sub: string, repo: boolean) => {
    const row = btn(`fdprow${path === s.place ? " on" : ""}`);
    row.append(icon("folder"), el("span", "fdprn", name), el("span", "fdmeta", sub), el("span", "fdprr fdmono", repo ? "git" : ""));
    row.title = `${tilde(path)} wählen`;
    row.onclick = () => { closePop(false); choosePlace(path); };
    const into = btn("fdinto");
    into.append(icon("chevron"));
    into.title = "Ordner öffnen";
    into.onclick = (e) => { e.stopPropagation(); void loadDir(path); };
    const wrap = el("div", "fdfrow");
    wrap.append(row, into);
    rows.append(wrap);
  };
  const paintFolders = () => {
    rows.replaceChildren();
    if (s.listErr) { rows.append(el("div", "fdnote warn", s.listErr)); return; }
    if (!s.list) { rows.append(el("div", "fdnote", "liest …")); return; }
    const base = s.list.path;
    const repoSet = new Set(s.list.repos ?? []);
    const q = s.find.trim();
    if (q && s.hits) {
      // the server's walk below this folder — a flat list, shortest path first (filetree.ts#matchTree)
      const rel = (p: string) => p.startsWith(`${base}/`) ? p.slice(base.length + 1) : p;
      const byRel = new Map(s.hits.map((h) => [rel(h.path), h]));
      for (const r of matchTree([...byRel.keys()], q)) {
        const h = byRel.get(r)!;
        add(h.path, h.name, r === h.name ? "" : r, h.repo);
      }
      if (!s.hits.length) rows.append(el("div", "fdnote", "Kein Ordner mit diesem Namen hier drunter."));
      if (s.findPartial) rows.append(el("div", "fdnote", "Die Suche hat nicht jeden Ordner gelesen — tiefer liegende Treffer können fehlen."));
    } else {
      const names = q ? matchTree(s.list.dirs, q) : s.list.dirs;
      for (const d of names) add(`${base}/${d}`.replace("//", "/"), d, "", repoSet.has(d));
      if (!names.length) rows.append(el("div", "fdnote", q ? "Hier kein passender Ordner." : "Dieser Ordner hat keine Unterordner."));
      if (!q && s.list.capped) rows.append(el("div", "fdnote", `${s.list.dirs.length} von ${s.list.total} Ordnern gezeigt — suche, um die übrigen zu finden.`));
    }
  };
  paintFolders();
  s.paintFolders = paintFolders;
  return pop;
}

async function loadDir(path: string) {
  const s = S;
  if (!s) return;
  const seq = ++s.listSeq;
  s.dir = path;
  s.list = null;
  s.listErr = null;
  s.find = "";
  s.hits = null;
  s.pop = "place";
  renderAll();
  focusPop();
  const res = await api(`/api/dirs?path=${encodeURIComponent(path)}`);
  if (S !== s || seq !== s.listSeq) return;
  const j = (await res.json().catch(() => null)) as (DirList & { error?: string }) | null;
  if (S !== s || seq !== s.listSeq) return;
  if (!res.ok || !j || !Array.isArray(j.dirs)) s.listErr = j?.error ?? `Der Server antwortete ${res.status} für diesen Ordner.`;
  else { s.list = j; s.dir = j.path; }
  if (s.pop === "place") { renderAll(); focusPop(); }
}

// two letters and more search BELOW the current folder on the server (findDirs: one walk, one
// budget, `truncated` said out loud); one letter only filters the level on screen
function scheduleFind() {
  const s = S;
  if (!s) return;
  if (s.findTimer) clearTimeout(s.findTimer);
  const q = s.find.trim();
  if (q.length < 2 || !s.list) { s.hits = null; return; }
  s.findTimer = setTimeout(async () => {
    const seq = ++s.findSeq;
    const res = await api(`/api/dirs?path=${encodeURIComponent(s.list!.path)}&find=${encodeURIComponent(q)}`);
    const j = (await res.json().catch(() => null)) as { hits?: FindHit[]; truncated?: boolean } | null;
    if (S !== s || seq !== s.findSeq || s.find.trim() !== q) return;
    s.hits = res.ok && j && Array.isArray(j.hits) ? j.hits : [];
    s.findPartial = !!j?.truncated;
    s.paintFolders?.();
  }, 220);
}

function choosePlace(path: string) {
  const s = S;
  if (!s) return;
  if (s.place !== path) {
    s.place = path;
    s.info = null;
    s.infoErr = null;
    s.answer = null;
    s.answerFor = null;
    s.planErr = null;
    s.switches.clear();
    s.note = null;
    s.moved = null;
    s.orphan = null;
    s.wt = "new";
    s.error = null;
    void loadInfo();
  }
  renderAll();
}

async function loadInfo() {
  const s = S;
  if (!s?.place) return;
  const seq = ++s.infoSeq;
  const path = s.place;
  const res = await api(`/api/dirinfo?path=${encodeURIComponent(path)}`);
  if (S !== s || seq !== s.infoSeq || s.place !== path) return; // latest-wins
  if (res.status === 404) { s.infoErr = SKEW_NOTE; renderAll(); return; }
  const info = (await res.json().catch(() => null)) as DirInfoResp | null;
  if (S !== s || seq !== s.infoSeq || s.place !== path) return;
  if (!res.ok || !info) { s.infoErr = info?.error ?? `Der Server antwortete ${res.status} für diesen Ordner.`; renderAll(); return; }
  s.info = info;
  renderAll();
}

// --- the MAIN's Program -----------------------------------------------------------------------------

const pickable = (p: ProgRow): boolean => p.state === "free" || p.state === "stale";
function progSays(p: ProgRow): string {
  if (p.state === "live") return `MAIN läuft${p.slot !== null ? ` auf Slot ${p.slot}` : ""}`;
  if (p.state === "stale") return `alte MAIN weg${p.slot !== null ? ` (Slot ${p.slot})` : ""} — wird ersetzt`;
  if (p.state === "free") return "ohne MAIN";
  return "Belegung unbekannt";
}
function progTip(p: ProgRow): string {
  if (p.state === "live") return "Dieses Program hat eine lebende MAIN — bootstrap-main würde sie nicht ersetzen.";
  if (p.state === "stale") return "Die gebundene MAIN lebt nicht mehr. Der Server prüft das beim Gründen noch einmal und nennt die ersetzte Bindung.";
  if (p.state === "free") return "Für dieses Program wurde noch keine MAIN gegründet.";
  return "GET /api/programs sagt nicht, ob dieses Program eine lebende MAIN hat (Gründung offen oder Belegung nicht gemeldet) — darum nicht wählbar.";
}

// ONLY THE ACTIVE PROGRAMS, the free ones first. A program the server says has a living MAIN stays
// on the list, greyed, with its slot — "it already has one" is an answer the owner should see.
function progList(): HTMLElement {
  const s = S!;
  const box = el("div", "fdopts");
  box.setAttribute("role", "radiogroup");
  box.setAttribute("aria-label", "Program der MAIN");
  if (s.progErr) {
    box.append(el("div", "fdnote warn", s.progErr));
    const again = btn("fdghost", "Neu lesen");
    again.onclick = () => { void loadProgs(); };
    box.append(again);
    return box;
  }
  if (!s.progs) { box.append(el("div", "fdnote", "Programs werden gelesen …")); return box; }
  for (const p of s.progs) {
    const on = s.program === p.id;
    const b = btn(`fdopt fdprog${on ? " on" : ""}${pickable(p) ? "" : " grey"}`);
    b.dataset.program = p.id;
    b.dataset.state = p.state;
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(on));
    b.disabled = !pickable(p);
    b.title = progTip(p);
    const w = el("span", "fdoptw fdpn");
    w.append(el("span", "", p.title), el("span", "fdsay2", progSays(p)));
    b.append(w);
    if (on) b.append(icon("check"));
    b.onclick = () => { s.program = on ? null : p.id; s.error = null; renderAll(); };
    box.append(b);
  }
  if (!s.progs.length) box.append(el("div", "fdnote", "Kein aktives Program — eine MAIN gehört immer zu einem."));
  if (s.progOther) box.append(el("div", "fdsay2", `${s.progOther} weitere nicht aktiv — bootstrap-main nimmt nur ein aktives Program.`));
  return box;
}

// a fresh read every time the MAIN role is chosen and after every answer of the door: whether a
// MAIN lives is a fact that moves, and a cached one would offer a founding the server refuses
async function loadProgs() {
  const s = S;
  if (!s) return;
  const seq = ++s.progSeq;
  s.progs = null;
  s.progErr = null;
  if (s.role === "main") renderAll();
  let rows: ProgRow[] | null = null, other = 0, err: string | null = null;
  try {
    const res = await api("/api/programs");
    const j: unknown = await res.json().catch(() => null);
    if (S !== s || seq !== s.progSeq) return; // latest-wins
    const list = j && typeof j === "object" && "programs" in j && Array.isArray(j.programs) ? (j.programs as unknown[]) : null;
    if (res.status === 404) err = SKEW_NOTE;
    else if (!res.ok || !list) err = `Die Programs sind nicht lesbar (Antwort ${res.status}).`;
    else {
      rows = [];
      for (const x of list) {
        const p = progRow(x);
        if (p === "inactive") other++;
        else if (p) rows.push(p);
      }
      const rank: Record<ProgState, number> = { free: 0, stale: 1, live: 2, unknown: 3 };
      rows.sort((a, b) => rank[a.state] - rank[b.state] || a.title.localeCompare(b.title));
    }
  } catch {
    if (S !== s || seq !== s.progSeq) return;
    err = "Die Programs konnten nicht geladen werden — der Server ist nicht erreichbar.";
  }
  s.progs = rows;
  s.progOther = other;
  s.progErr = err;
  // the first free Program is the likely one; the owner sees it chosen and can pick another
  if (rows && !s.program) s.program = rows.find(pickable)?.id ?? null;
  renderAll();
}

// a row off the wire; "inactive" is counted, not shown; null is a row this build cannot read at all
function progRow(x: unknown): ProgRow | "inactive" | null {
  if (!x || typeof x !== "object") return null;
  const r = x as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id) return null;
  if (r.status !== "active") return "inactive";
  const title = typeof r.title === "string" && r.title.trim() ? r.title : r.id;
  const main = r.main && typeof r.main === "object" ? r.main as Record<string, unknown> : null;
  const slot = main && typeof main.slot === "number" ? main.slot : null;
  const health = r.health && typeof r.health === "object" ? r.health as Record<string, unknown> : null;
  const occ = health?.occupancy;
  const state: ProgState = r.founding !== undefined && r.founding !== null ? "unknown"
    : occ === "live" ? "live" : occ === "stale" ? "stale" : occ === "unbound" ? "free" : "unknown";
  return { id: r.id, title, state, slot };
}

// --- THE PLAN -------------------------------------------------------------------------------------

// a continued worktree starts without a plan (attach refuses one); every other session reads one
const needsPlan = (): boolean => {
  const s = S!;
  return s.kind === "session" && !!s.place && !!s.info?.git && !(s.role === "lane" && s.wt === "old");
};

// the query hangs off role, place, the triple and the switches; a change of any of them reads it again
function planQuery(): string {
  const s = S!;
  const q = new URLSearchParams({ repo: s.place ?? "", role: s.role, ort: ORT[s.role] });
  if (s.harness) q.set("harness", s.harness);
  if (s.model) q.set("model", s.model);
  if (s.effort) q.set("effort", s.effort);
  if (s.switches.size) q.set("bausteine", [...s.switches].map(([id, v]) => `${id}=${v}`).join(","));
  return `/api/founding-plan?${q}`;
}
const planKey = (): string => planQuery();
// the answer on screen, if it answers the current query
const fresh = (): Answer | null => S?.answer && S.answerFor === planKey() ? S.answer : null;

async function loadPlan() {
  const s = S;
  if (!s?.place) return;
  const seq = ++s.planSeq;
  const key = planKey();
  s.answerFor = key;
  s.planErr = null;
  let refused: string | null = null;
  try {
    const res = await api(key);
    if (S !== s || seq !== s.planSeq) return; // latest-wins
    if (res.status === 404) { s.planErr = SKEW_NOTE; return; }
    const j: unknown = await res.json().catch(() => null);
    if (S !== s || seq !== s.planSeq) return;
    if (res.status === 400 && s.last && s.switches.has(s.last)) refused = j && typeof j === "object" && "error" in j ? String(j.error) : `Antwort ${res.status}`;
    else if (!res.ok) s.planErr = `Der Plan für diesen Start ist nicht lesbar: ${j && typeof j === "object" && "error" in j ? String(j.error) : `Antwort ${res.status}`}.`;
    else if (!validAnswer(j)) s.planErr = "Der Plan für diesen Start ist nicht lesbar — der Server antwortet in einer anderen Form.";
    else {
      s.answer = j;
      s.rollen = j.rollen;
      // the first answer names the role's standard; the fields take it, and the plan is read for it
      if (s.tripleFor !== s.role && agentHarnesses().length) { applyStandard(); }
    }
  } catch {
    if (S !== s || seq !== s.planSeq) return;
    s.planErr = "Der Plan für diesen Start konnte nicht geladen werden.";
  } finally {
    if (S === s && seq === s.planSeq) {
      // A SWITCH THE PLAN REFUSES is taken back and said with the server's reason — never kept silently
      if (refused !== null && s.last) {
        const row = s.answer?.plan.bausteine.find((b) => b.id === s.last);
        s.switches.delete(s.last);
        s.note = `${row?.wort ?? s.last}: ${refused}`;
        s.last = null;
        s.answerFor = null;
      }
      renderAll();
    }
  }
}

// the newer fields are OPTIONAL: an older server omits them, and the window then says "nicht gemeldet";
// a field that is present in a wrong shape makes the whole plan unreadable, never half-believed
const strs = (v: unknown): boolean => Array.isArray(v) && v.every((x) => typeof x === "string");
const optional = (o: object, k: string, ok: (v: unknown) => boolean): boolean =>
  !(k in o) || (o as Record<string, unknown>)[k] === undefined || ok((o as Record<string, unknown>)[k]);
function validAnchors(v: unknown): v is PackAnchors {
  if (Array.isArray(v)) return v.every((a: unknown) => !!a && typeof a === "object"
    && typeof (a as Record<string, unknown>).path === "string" && typeof (a as Record<string, unknown>).anchor === "string");
  return !!v && typeof v === "object" && typeof (v as Record<string, unknown>).privateSourceId === "string";
}
const nullable = (ok: (v: unknown) => boolean) => (v: unknown): boolean => v === null || ok(v);
const isStr = (v: unknown): boolean => typeof v === "string";
const isNum = (v: unknown): boolean => typeof v === "number" && Number.isFinite(v) && v >= 0;
function validPart(p: unknown): p is FoundingPlanPart {
  if (!p || typeof p !== "object") return false;
  const r = p as Record<string, unknown>;
  return isStr(r.id) && nullable(isStr)(r.packId) && nullable(isStr)(r.path) && nullable(isStr)(r.anchor)
    && (r.sorte === "anleitung" || r.sorte === "wissen") && (r.ort === "box" || r.ort === "ausleihe")
    && nullable(isStr)(r.sha256) && nullable(isNum)(r.bytes) && nullable(isStr)(r.content)
    && (r.refusal === null || r.refusal === "source-unavailable" || r.refusal === "source-anchor-missing"
      || r.refusal === "source-anchor-ambiguous");
}
function validFile(v: unknown): v is FoundingSessionAgents {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return isStr(r.text) && isNum(r.bytes) && Array.isArray(r.parts) && r.parts.every(validPart);
}
function validPlan(j: unknown): j is Plan {
  if (!j || typeof j !== "object" || !("selected" in j) || !("omitted" in j)) return false;
  return Array.isArray(j.selected) && Array.isArray(j.omitted)
    && optional(j, "head", (v) => typeof v === "string") && optional(j, "plannedAt", (v) => typeof v === "number" && Number.isFinite(v))
    && optional(j, "sessionAgents", validFile)
    && j.selected.every((p: unknown) => !!p && typeof p === "object"
      && "id" in p && typeof p.id === "string" && "bytes" in p && typeof p.bytes === "number"
      && Number.isFinite(p.bytes) && p.bytes >= 0 && "source" in p
      && (p.source === "fleet-seed" || p.source === "repo-manifest")
      && (!("useWhen" in p) || p.useWhen === undefined || typeof p.useWhen === "string")
      && optional(p, "harnesses", strs) && optional(p, "triggers", strs) && optional(p, "anchors", validAnchors)
      && optional(p, "sourceHash", (v) => typeof v === "string") && optional(p, "group", isStr)
      && optional(p, "parts", (v) => Array.isArray(v) && v.every(validPart)))
    && j.omitted.every((p: unknown) => !!p && typeof p === "object"
      && "id" in p && typeof p.id === "string" && "reason" in p && typeof p.reason === "string"
      && optional(p, "harnesses", strs));
}

// THE FOUR GROUPS of the pack register (context-packs.ts#CONTEXT_PACK_GROUPS) order the pack rows of
// Anpassen — one flat list (owner 01.10.: no card list), packs of a group side by side
const GROUPS: { id: string }[] = [{ id: "grundlagen" }, { id: "pruefen-landen" }, { id: "sessions-fuehren" }, { id: "vor-arbeiten" }];

// the session plan of dd3d548a: a present plan in a wrong shape is unreadable, never half-believed
const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLE_IDS as readonly string[]).includes(v);
function validBaustein(v: unknown): v is Baustein {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  const g = r.grenze as Record<string, unknown> | null;
  const h = r.harness as Record<string, unknown> | null;
  const sb = r.schaltbar as Record<string, unknown> | null;
  const rd = r.rollenDefault;
  return isStr(r.id) && isStr(r.wort) && isStr(r.satz) && strs(r.funktion) && isStr(r.schicht) && isStr(r.zustand)
    && (r.quelle === "default" || r.quelle === "schalter")
    && !!g && typeof g === "object" && (g.art === "frei" || (g.art === "noetig" && isStr(g.grund)))
    && (rd === "an" || rd === "aus" || (!!rd && typeof rd === "object" && (rd as Record<string, unknown>).zustand === "bedingt"))
    && !!h && typeof h === "object" && typeof h.gueltig === "boolean"
    && !!sb && typeof sb === "object" && (sb.ja === true || (sb.ja === false && isStr(sb.grund)))
    && (isNum(r.bytes) || r.bytes === "unknown") && strs(r.ersatzKandidaten) && optional(r, "enthaltenIn", isStr);
}
function validAnswer(j: unknown): j is Answer {
  if (!validPlan(j)) return false;
  const r = j as unknown as Record<string, unknown>;
  const p = r.plan as Record<string, unknown> | null;
  const v = p?.bytesVorAuftrag as Record<string, unknown> | null;
  const st = r.start as Record<string, unknown> | null;
  return !!p && typeof p === "object" && isStr(p.planHash) && isStr(p.planSatz) && isRole(p.rolle)
    && !!v && typeof v === "object" && isNum(v.bytes) && strs(v.unknown) && strs(v.auftrag)
    && Array.isArray(p.bausteine) && p.bausteine.every(validBaustein)
    && Array.isArray(r.rollen) && r.rollen.every((x: unknown) => !!x && typeof x === "object" && isRole((x as RolleRow).id) && isStr((x as RolleRow).wort))
    && !!st && typeof st === "object" && (st.tuer === "lane" || st.tuer === "open") && typeof st.startbar === "boolean" && strs(st.refusals);
}

// the plan's omission reasons are a closed vocabulary (context-plan.ts CONTEXT_PLAN_OMISSION_REASONS);
// the window says each in owner words — an unknown future reason is shown raw rather than hidden
const OMIT_SAY: Record<string, string> = {
  "manifest-invalid": "Pack-Verzeichnis nicht lesbar",
  "source-unavailable": "Quelle nicht im Repo",
  "status-not-active": "abgeschaltet",
  "harness-unsupported": "nicht für diesen Agenten",
  "mode-unsupported": "nicht für diese Rolle",
  "trigger-not-matched": "passt nicht zu diesem Start",
  "capability-missing": "Fähigkeit fehlt hier",
  "program-complete": "Program abgeschlossen",
};

// the words of the view for the packs (design v3 §0, "Wörter der Ansicht"); a pack without words here
// is named by its own id, never by a guess
const PACK_WORDS: Record<string, { name: string; say: string }> = {
  "portable-core": { name: "Grundregeln", say: "Begriffe und feste Regeln, die jede Session bindet." },
  "konzept-claude-fleet": { name: "Was Claude Fleet ist", say: "Das Konzept und seine Prinzipien." },
  "verify-e2e": { name: "Prüfen", say: "Wann eine Änderung als bewiesen gilt." },
  "land-mechanics": { name: "Landen", say: "Was beim Landen einer Lane wirklich passiert." },
  "harness-adapter": { name: "Agent-Anbindung", say: "Wie ein Agent-Programm angebunden wird." },
  "orchestrator-eigenarten": { name: "Eigenarten der Orchestrierung", say: "Watches und Nachfolge, zwei bezahlte Lektionen." },
  "rulebook-generat": { name: "Regelbuch ändern", say: "Das Regelbuch wird erzeugt, nicht von Hand bearbeitet." },
  "messnotiz-index": { name: "Frühere Messungen", say: "Erst nachsehen, ob es schon gemessen wurde." },
  "jev-use": { name: "Jev", say: "Wie Jev verwendet wird." },
  "owner-instanzweg": { name: "Weg zum Owner", say: "Wie eine Session den Owner erreicht." },
  "gestaltungsgrammatik": { name: "Gestaltungsgrammatik", say: "docs/design, auf Abruf." },
};
// a part whose source this plan could not cut cannot stand whole in the file — said in its Details
const partFixed = (x: FoundingPlanPart): string | null =>
  x.privateSourceId ? "Privat: der Text dieser Quelle kommt nie in die Datei, nur ihr Hinweis."
  : x.refusal === "source-unavailable" ? "Die Quelle liegt an diesem Stand nicht im Repo."
  : x.refusal === "source-anchor-missing" ? "Die Überschrift der Quelle fehlt an diesem Stand."
  : x.refusal === "source-anchor-ambiguous" ? "Anker nicht eindeutig." : null;

// whether this start can begin now — null when it can. Said next to the button, never only as a
// greyed-out control.
function blocker(): string | null {
  const s = S!;
  if (!s.place) return "Wähle, wo die Session laufen soll.";
  if (s.info && !s.info.git) return "Hier ist kein Git-Repo — eine Session mit Plan braucht eins.";
  if (s.role === "orchestratorin" && runningOrch()) return `Die Orchestratorin läuft schon auf Slot ${runningOrch()!.id}.`;
  if (s.role !== "lane" && freePlace() === null) return "Kein freier Platz in der Leiste.";
  if (s.role === "main") {
    if (s.progErr) return "Die Programs sind nicht lesbar — ohne sie wird keine MAIN gegründet.";
    if (!s.progs) return "Die Programs werden gelesen …";
    const p = s.progs.find((x) => x.id === s.program);
    if (!p) return s.progs.some(pickable) ? "Wähle das Program, dessen MAIN du gründest." : "Kein aktives Program ohne lebende MAIN.";
    if (!pickable(p)) return `„${p.title}“ ist nicht mehr wählbar: ${progSays(p)}.`;
    return null;
  }
  if (s.role === "lane" && chosenHarness()?.allowsLanes === false) return `${harnessWord(chosenHarness()!.id)} läuft nur als Haupt-Session, nicht als Lane.`;
  if (s.role === "lane" && s.wt === "old") return s.orphan ? null : "Wähle den Worktree, der weiterlaufen soll.";
  if (s.planErr) return s.planErr;
  const a = fresh();
  if (!a) return "Der Plan für diesen Start wird gelesen …";
  if (!a.start.startbar) return refusalSay(a);
  return null;
}

// the door's refusals in owner words: which Bausteine it would deliver although the plan says no
function refusalSay(a: Answer): string {
  const words: string[] = [];
  for (const r of a.start.refusals) {
    const id = /^([a-z0-9:._-]+) /i.exec(r)?.[1];
    const w = id ? a.plan.bausteine.find((b) => b.id === id)?.wort : undefined;
    const word = w ?? r;
    if (!words.includes(word)) words.push(word);
  }
  return `Diese Tür startet den Plan noch nicht genau so: sie liefert trotzdem ${words.join(", ")}.`;
}

// --- the foot: the plan's sentence, the deviations, and the one button ---------------------------------

function renderFoot() {
  const s = S;
  if (!s) return;
  if (s.proof) { renderProof(); return; }
  const foot = s.shell.foot;
  // the button is rebuilt on every paint; if it held the focus, the new one takes it over
  const hadGo = document.activeElement instanceof HTMLElement && document.activeElement.classList.contains("fdgo") && foot.contains(document.activeElement);
  foot.replaceChildren();
  const text = el("div", "fdsaycol");
  const acts = el("div", "fdacts");
  if (s.kind === "branch") {
    text.append(el("div", "fdfootnote", BRANCH_DOOR));
    const go = btn("fdgo", "Branch anlegen");
    go.disabled = true;
    go.title = BRANCH_DOOR;
    acts.append(go);
    foot.append(text, acts);
    return;
  }
  if (s.kind === "task") {
    const r = s.task.receipt;
    if (r) {
      const again = btn("fdgo", "Noch einer");
      again.dataset.act = "again";
      again.onclick = () => { s.task = { text: "", busy: false, receipt: null, error: null }; renderAll(); };
      acts.append(again);
      foot.append(text, acts);
      return;
    }
    const orch = runningOrch();
    const empty = !s.task.text.trim();
    const toOrch = btn("fdsecond", s.task.busy ? "…" : "An die Orchestratorin");
    toOrch.dataset.act = "orch";
    toOrch.disabled = empty || s.task.busy || !orch;
    toOrch.title = orch ? `Als Nachricht an die Orchestratorin auf Slot ${orch.id} — sie schärft und verteilt.` : "Keine Orchestratorin läuft.";
    toOrch.onclick = () => { void taskToOrch(); };
    const file = btn("fdgo", s.task.busy ? "Wird gefilet …" : "Als Karte filen");
    file.dataset.act = "file";
    file.disabled = empty || s.task.busy || !s.place;
    file.title = "Als Zeile in die Warteschlange, noch nicht freigegeben (⌘⏎)";
    file.onclick = () => { void fileTask(); };
    text.append(el("div", "fdfootnote", !orch ? "Keine Orchestratorin läuft — die Karte geht in die Warteschlange." : s.place ? `Karte für ${baseName(s.place)}` : "Wähle das Repo der Karte."));
    acts.append(toOrch, file);
    foot.append(text, acts);
    return;
  }
  if (s.layer === "anpassen") {
    const devs = deviations();
    const n = el("div", `fddev${devs.length ? "" : " quiet"}`);
    if (devs.length) n.append(el("i", "fddot2"));
    n.append(el("span", "", devs.length ? `${devs.length} ${devs.length === 1 ? "Abweichung" : "Abweichungen"}` : "wie der Standard der Rolle"));
    if (devs.length) n.title = devs.join(" · ");
    text.append(n);
    const ok = btn("fdgo", "Übernehmen");
    ok.dataset.act = "take";
    ok.title = "Zurück zur Rolle — die Anpassung gilt für diese Session.";
    ok.onclick = () => setLayer("rolle");
    acts.append(ok);
    foot.append(text, acts);
    return;
  }
  // THE SENTENCE is the plan's own (planSatz); a continued worktree has no plan and says what it does
  const a = fresh();
  const say = el("div", "fdsay");
  if (s.role === "lane" && s.wt === "old") {
    const o = s.info?.orphans?.find((x) => x.path === s.orphan);
    say.textContent = o ? `Lane · setzt ${o.branch || baseName(o.path)} fort · ohne neuen Plan` : "Lane · setzt einen Worktree fort";
  } else say.textContent = a ? a.plan.planSatz : s.planErr ? "—" : "Plan wird gelesen …";
  text.append(say);
  if (s.role === "main") {
    const p = s.progs?.find((x) => x.id === s.program);
    if (p) text.append(el("div", "fdsay2", `Program: ${p.title}`));
  }
  const devs = s.role === "lane" && s.wt === "old" ? [] : deviations();
  if (devs.length) {
    const n = el("div", "fddev");
    n.append(el("i", "fddot2"), el("span", "", `${devs.length} ${devs.length === 1 ? "Abweichung" : "Abweichungen"} vom Standard`));
    n.title = devs.join(" · ");
    text.append(n);
  }
  // bootstrap-main picks the free MAIN place itself — the clicked one is a likely answer, not a promise
  const seat = s.role === "main" && s.entry.kind === "slot" ? `Den Platz wählt der Server — nicht unbedingt Slot ${s.entry.slot}.` : null;
  const why = s.moved ?? s.error ?? blocker() ?? seat;
  if (why) text.append(el("div", `fdfootnote${s.moved || s.error || (a && !a.start.startbar) ? " warn" : ""}`, why));
  if (a && !a.start.startbar && why === refusalSay(a)) text.lastElementChild!.setAttribute("title", a.start.refusals.join("\n"));
  const go = btn("fdgo");
  const label = s.busy ? "Startet …" : "Starten";
  go.append(el("span", "", label));
  if (!s.busy && !isMobile()) go.append(el("kbd", "", "⏎"));
  go.disabled = s.busy || blocker() !== null;
  go.title = s.place ? `${label}: ${tilde(s.place)} (Enter)` : label;
  go.onclick = () => { void start(); };
  acts.append(go);
  foot.append(text, acts);
  if (hadGo) go.focus({ preventScroll: true });
}

// --- starting ----------------------------------------------------------------------------------------

// the triple exactly as the plan was read for it: a door re-plans from these fields, so they must match
function triple(): { harness?: string; model?: string; effort?: string; container?: string; containerContext?: string } {
  const s = S!;
  return {
    ...(s.harness ? { harness: s.harness } : {}),
    ...(s.model ? { model: s.model } : {}),
    ...(s.effort ? { effort: s.effort } : {}),
    ...(s.container ? { container: s.container } : {}),
    ...(s.containerContext ? { containerContext: s.containerContext } : {}),
  };
}
// THE PLAN A START CARRIES (faafc637): the hash the window showed, the role, the place and the switches
function planBody(a: Answer): { hash: string; role: Role; ort: string; bausteine?: Record<string, string> } {
  const s = S!;
  return { hash: a.plan.planHash, role: s.role, ort: ORT[s.role], ...(s.switches.size ? { bausteine: Object.fromEntries(s.switches) } : {}) };
}

async function start() {
  const s = S;
  if (!s || s.kind !== "session" || s.busy || s.proof || blocker() !== null || !s.place) return;
  s.error = null;
  s.moved = null;
  const onError = (msg: string) => { if (S === s) { s.error = msg; renderFoot(); } };
  s.busy = true;
  renderFoot();
  try {
    const body = triple();
    // the start receipt (552958ea): what was asked, read back at the occupant the start produced
    const before = new Map(fleet.map((row) => [row.id, row.openedAt]));
    const requestedRole = s.role;
    const requestedPlace = s.role === "lane" && s.wt === "old" ? s.orphan! : s.place;
    const a = fresh();
    const packs = a ? a.plan.bausteine.filter((b) => b.id.startsWith("pack:") && b.zustand === "an").map((b) => b.id.slice(5)) : [];
    const preview: StartPreview | null = a && packs.length
      ? { head: a.head ?? null, plannedAt: a.plannedAt ?? null, packs: a.selected.filter((p) => packs.includes(p.id)) } : null;
    let result: StartResult;
    let bound: number | null = null;
    if (s.role === "main") {
      const pid = s.program!;
      const said = await foundMain(pid, onError);
      // every answer can move the binding; the list is read again whatever came back
      void loadProgs();
      if (!said) return;
      bound = said.bound;
      if (!await revealStartedSlot(said.slot)) { onError(`Die MAIN steht, aber Slot ${said.slot} erschien nicht binnen 5 Sekunden.`); return; }
      result = { ok: true, slot: said.slot };
    } else if (s.role === "lane" && s.wt === "old") {
      // a continued worktree: the clicked place seats it exactly there, ⎇+ lets the server pick.
      // An attach never carries a plan — the door refuses one for a worktree it did not found.
      const slot = s.entry.kind === "slot" ? { slot: s.entry.slot } : {};
      const said = await door("/api/lanes", { repo: s.place, attach: s.orphan, ...slot, ...body }, onError);
      if (!said) return;
      result = said;
    } else {
      if (!a) return;
      const plan = planBody(a);
      const free = freePlace();
      const url = s.role === "lane" ? (s.entry.kind === "lane" ? "/api/lanes" : `/api/slots/${s.entry.slot}/open-worktree`) : `/api/slots/${free}/open`;
      const req = s.role === "lane"
        ? { repo: s.place, ...(s.entry.kind === "lane" && s.entry.parent ? { parent: s.entry.parent } : {}), branch: "", ...body, plan }
        : { cwd: s.place, ...(s.role === "orchestratorin" ? { label: ORCH_LABEL } : {}), ...body, plan };
      // the door names the slot it took where it picks one (/api/lanes); the others seat it where asked
      const seat = s.role !== "lane" ? free ?? undefined : s.entry.kind === "slot" ? s.entry.slot : undefined;
      const said = await door(url, req, onError, seat);
      if (!said) return;
      result = said;
    }
    if (result.ok && S === s) await captureProof(s, body, before.get(result.slot), result, requestedRole, requestedPlace, bound, preview, packs, a?.plan.planSatz ?? null);
  } finally {
    // a start answers seconds later (boot grace plus readiness); by then the owner may have closed this
    // window and opened the next — only the window that asked shows the receipt
    if (S === s) { s.busy = false; renderFoot(); }
  }
}

// ONE DOOR CALL: a 409 that carries the moved plan (staleHash) puts that plan on screen and starts
// nothing; any other refusal is said as the server wrote it
async function door(url: string, req: Record<string, unknown>, onError: (msg: string) => void, slot?: number): Promise<Extract<StartResult, { ok: true }> | null> {
  const s = S!;
  let res: Response;
  try { res = await post(url, req); } catch (e) {
    onError(`Der Server ist nicht erreichbar: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
  const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.status === 409 && j && typeof j.staleHash === "string" && validAnswer(j)) {
    if (S === s) {
      s.answer = j;
      s.answerFor = planKey();
      s.moved = `Der Plan hat sich seit der Vorschau bewegt — nichts gestartet. Oben steht der Plan von jetzt; Starten nimmt ihn.`;
      renderAll();
    }
    return null;
  }
  if (!res.ok) { onError(typeof j?.error === "string" ? j.error : `Der Server antwortete ${res.status}.`); return null; }
  const at = typeof j?.slot === "number" ? j.slot : slot;
  const delivered = typeof j?.packsDelivered === "boolean" ? j.packsDelivered : undefined;
  const reason = typeof j?.reason === "string" ? j.reason : undefined;
  // the session stands; a delivery refusal stays visible in its start receipt
  if (delivered === false) onError(reason ?? "Die Session steht, aber ihre Packs kamen nicht an.");
  if (at === undefined || !await revealStartedSlot(at)) { onError(`Die Session steht, aber ihr Slot erschien nicht binnen 5 Sekunden.`); return null; }
  return { ok: true, slot: at, packsDelivered: delivered, reason };
}

// THE MAIN'S DOOR. A refusal is shown as the server wrote it, status first and every further field
// of its answer verbatim (a 503 carries availability/recovery/affected beside the sentence), and
// existing:true is shown as what it is — the Program already has a living MAIN, nothing was founded.
async function foundMain(pid: string, onError: (msg: string) => void): Promise<{ slot: number; bound: number | null } | null> {
  let res: Response;
  const s = S!;
  try {
    const { container: _c, containerContext: _cc, ...spawn } = triple();
    res = await post(`/api/programs/${encodeURIComponent(pid)}/bootstrap-main`, { cwd: s.place ?? "", ...spawn });
  } catch (e) {
    onError(`Der Server ist nicht erreichbar: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
  const j: unknown = await res.json().catch(() => null);
  const r = j && typeof j === "object" && !Array.isArray(j) ? j as Record<string, unknown> : null;
  if (!res.ok) {
    const { error, ...rest } = r ?? {};
    const more = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : "";
    onError(typeof error === "string" && error ? `Abgelehnt (${res.status}): ${error}${more}` : `Abgelehnt (${res.status}), ohne lesbaren Grund${more}`);
    return null;
  }
  if (r?.existing === true) {
    const main = r.program && typeof r.program === "object" ? (r.program as { main?: { slot?: unknown } }).main : undefined;
    onError(`existing: true — das Program hat schon eine lebende MAIN${typeof main?.slot === "number" ? ` auf Slot ${main.slot}` : ""}. Nichts wurde gegründet.`);
    return null;
  }
  if (typeof r?.slot !== "number") { onError(`Die Antwort nennt keinen Slot: ${JSON.stringify(j)}`); return null; }
  const prog = r.program && typeof r.program === "object" ? r.program as { main?: { slot?: unknown } } : null;
  return { slot: r.slot, bound: typeof prog?.main?.slot === "number" ? prog.main.slot : null };
}

// --- the start receipt -------------------------------------------------------------------------------

interface ReceiptPack {
  id: string; useWhen?: string;
  anchors: { path: string; anchor: string }[] | { privateSourceId: string };
  sourceHash?: string; private?: { verdict: string; version: number | null };
}
interface StartPreview { head: string | null; plannedAt: number | null; packs: FoundingPlanPack[] }
interface StartProof {
  result: Extract<StartResult, { ok: true }>;
  body: ReturnType<typeof triple>; role: Role; place: string;
  packs: string[];                      // the plan's pack rows that were on
  planSatz: string | null;              // the sentence the start was made with
  bound: number | null;                 // a MAIN: the slot the Program's binding names after the door
  preview: StartPreview | null;         // the plan's state of the chosen packs when the start was pressed
  occupant: SlotInfo | null;
  receipt: { slot: number; at: number; head?: string; selected: ReceiptPack[]; omitted?: { id: string; why?: string; reason?: string | null }[] } | null;
  receiptCount: number; receiptError: string | null; stale: boolean;
}

// WHAT A PACK IS, in the words the receipt shares: a fassung only where the id declares one
// (src/protocol.ts#packIdFassung)
const fassungSay = (id: string): string => {
  const n = packIdFassung(id);
  return n === null ? "keine Fassung deklariert" : `Fassung v${n} · laut Paket-ID`;
};
const short = (sha: string | undefined | null, n: number): string => sha ? sha.slice(0, n) : "nicht gemeldet";

async function captureProof(s: State, body: StartProof["body"], before: number | undefined, result: Extract<StartResult, { ok: true }>,
  role: Role, place: string, bound: number | null, preview: StartPreview | null, packs: string[], planSatz: string | null) {
  const row = fleet.find((r) => r.id === result.slot);
  const occupant = row?.cwd && Number.isFinite(row.openedAt) && row.openedAt! > 0 && row.openedAt !== before
    ? structuredClone(row) : null;
  const proof: StartProof = { result, body, role, place, packs, planSatz, bound, preview, occupant,
    receipt: null, receiptCount: 0, receiptError: null, stale: false };
  s.proof = proof;
  closePop(false);
  s.shell.root.classList.add("fdproved");
  s.shell.setTitle("Gestartet");
  s.shell.setRows([]);
  s.shell.tools.replaceChildren();
  s.shell.list.replaceChildren();
  s.shell.detail.replaceChildren();
  const watch = new MutationObserver(() => {
    if (!proof.occupant || proof.stale) return;
    const current = fleet.find((r) => r.id === result.slot);
    if (!current?.cwd || current.openedAt !== proof.occupant.openedAt) {
      proof.stale = true;
      if (S === s) renderProof();
    }
  });
  const slots = document.getElementById("slots");
  if (slots) watch.observe(slots, { childList: true, subtree: true });
  const teardown = s.teardown;
  s.teardown = () => { watch.disconnect(); dropGrantMount("proof"); teardown(); };
  renderProof();
  if (packs.length || role === "orchestratorin" || role === "main") {
    try {
      const response = await api("/api/context-receipts");
      if (!response.ok) throw new Error(`Der Server antwortete ${response.status}.`);
      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || !("receipts" in data) || !Array.isArray(data.receipts))
        throw new Error("Die Antwort mit den Startbelegen war nicht lesbar.");
      const current = fleet.find((r) => r.id === result.slot);
      if (occupant && (!current?.cwd || current.openedAt !== occupant.openedAt)) proof.stale = true;
      if (occupant && !proof.stale) {
        const matching = data.receipts.filter((r): r is NonNullable<StartProof["receipt"]> =>
          !!r && typeof r === "object" && r.slot === result.slot && Number.isFinite(r.at)
          && r.at >= occupant.openedAt! && Array.isArray(r.selected));
        matching.sort((a, b) => b.at - a.at);
        proof.receipt = matching[0] ?? null;
        proof.receiptCount = matching.length;
      }
    } catch (error) { proof.receiptError = error instanceof Error ? error.message : String(error); }
    if (S === s) renderProof();
  }
}

// the receipt's HEAD against the preview's, said as a fact of each side
function headSay(stand: PackStand | null, head: string | undefined): string {
  const h = `HEAD ${short(head, 8)}`;
  if (!stand || stand.head === "unknown")
    return `${h} · Vergleich mit der Vorschau unbekannt${stand?.previewHead ? ` (Vorschau HEAD ${short(stand.previewHead, 8)})` : ""}`;
  return stand.head === "same" ? `${h} · wie in der Vorschau` : `${h} · seit der Vorschau bewegt (dort HEAD ${short(stand.previewHead, 8)})`;
}
function standSay(stand: PackStand["packs"][number]["stand"], before: string | null, now: string | null): string {
  switch (stand) {
    case "same": return "Stand wie in der Vorschau";
    case "changed": return `Stand seit der Vorschau geändert: ${short(before, 12)} → ${short(now, 12)} — zugestellt ist der neue`;
    case "drift": return "Urteil drift: die Datei bei der Zustellung ist nicht die deklarierte Fassung";
    case "not-delivered": return "nicht zugestellt";
    case "extra": return "nicht angefragt";
    default: return `Stand unbekannt: ${before === null && now === null ? "weder Vorschau noch Beleg nennen" : before === null ? "die Vorschau nennt" : "der Beleg nennt"} keinen Hash`;
  }
}

function renderProof() {
  const s = S;
  if (!s?.proof) return;
  const p = s.proof, row = p.occupant;
  const detail = s.shell.detail;
  detail.replaceChildren();
  const status = p.stale ? "Veraltet — dieser Slot wurde neu belegt."
    : !row ? "Keine neue Session gestartet — kein Startbeleg."
    : `Slot ${p.result.slot} · geöffnet ${new Date(row.openedAt!).toLocaleTimeString("de-DE")}`;
  detail.append(el("div", `fdproofstatus${p.stale || !row ? " warn" : ""}`, status));
  if (p.planSatz) detail.append(el("div", "fdsay fdproofplan", p.planSatz));
  // the head names the window's content, never a slot state (owner 02.10.)
  s.shell.setSubtitle(`Startbeleg · Slot ${p.result.slot}`);
  const table = el("div", "fdproof");
  table.setAttribute("role", "table");
  const header = el("div", "fdproofrow fdproofheadrow");
  header.append(el("span", ""), el("span", "fdproofhead", "angefragt"), el("span", "fdproofhead", "am Slot zurückgelesen"));
  table.append(header);
  // WITHOUT A NEW SESSION nothing was read back, and the status line says so once: the right column
  // is a muted "—" (owner 02.10.). Orange stays for a real gap — a session that started and did not
  // report a field, or a value that differs.
  const field = (name: string, requested: string | undefined, observed: string | undefined, mono = false, compare = true, comparedValue = observed) => {
    const r = el("div", "fdproofrow"); r.dataset.field = name;
    if (!row && observed === undefined) {
      r.dataset.state = "unread";
      const none = el("div", "fdactual fdnone", "—");
      r.append(el("span", "fdproofkey", name), el("div", `fdrequested${mono ? " fdmono" : ""}`, requested ?? "ohne Angabe"), none);
      table.append(r);
      return none;
    }
    const missing = observed === undefined;
    const differs = compare && requested !== undefined && !missing && requested !== comparedValue;
    r.dataset.state = missing ? "missing" : differs ? "difference" : "same";
    const actual = el("div", `fdactual${missing || differs ? " warn" : ""}${mono ? " fdmono" : ""}`, observed ?? "nicht gemeldet");
    if (differs) actual.append(el("span", "fdproofnote", "Abweichung"));
    else if (missing) actual.append(el("span", "fdproofnote", "Beleg fehlt"));
    else if (requested === undefined && compare) actual.append(el("span", "fdproofnote", "Standard, nicht angefragt"));
    r.append(el("span", "fdproofkey", name), el("div", `fdrequested${mono ? " fdmono" : ""}`, requested ?? "ohne Angabe"), actual);
    table.append(r);
    return actual;
  };
  // the role in the window's own words, read back from the slot by the same marks the server keys off
  const roleName = (r: Role): string => ROLE_SAY[r].word;
  const observedRole = !row ? undefined : roleName(p.role === "main" && p.bound === p.result.slot ? "main"
    : row.worktree ? "lane" : row.role === "orchestrator" ? "orchestratorin" : "nur-ordner");
  field("Rolle", roleName(p.role), observedRole);
  const place = field("Ort", p.place, row?.cwd ?? undefined, true, true, p.role === "lane" ? row?.worktree?.repo ?? row?.cwd ?? undefined : row?.cwd ?? undefined);
  if (row?.worktree) place.append(el("div", "fdmono", `Branch: ${row.worktree.branch ?? "nicht gemeldet"}`));
  field("Agent", p.body.harness, row ? row.harness ?? harnesses.find((h) => h.default)?.id : undefined, true);
  field("Modell", p.body.model, row?.model ?? undefined, true);
  field("Effort", p.body.effort, row?.effort, true);
  if (p.body.container || row?.container) field("Container", p.body.container, row?.container, true);
  if (p.body.containerContext || row?.containerContext) field("Docker-Daemon", p.body.containerContext, row?.containerContext, true);
  // without a new session nothing was read back, so "keine" would claim what nobody measured
  const needsReceipt = p.packs.length > 0 || p.role === "orchestratorin" || p.role === "main";
  const packCell = field("Packs", p.packs.length ? p.packs.join("\n") : p.role === "main" ? "Gründungsbrief des Programs" : "keine",
    p.result.packsDelivered === false ? `nicht zugestellt: ${p.result.reason ?? "Grund nicht gemeldet"}`
      : !row ? undefined : !needsReceipt ? "keine" : p.receipt ? p.receipt.selected.map((pack) => pack.id).join("\n") : undefined, true, false);
  if (p.result.packsDelivered === false) packCell.classList.add("warn");
  else if (p.receipt) {
    packCell.replaceChildren();
    // THE RECEIPT AGAINST THE PREVIEW (src/protocol.ts#standSincePreview): the receipt's hash and HEAD
    // are what the delivery stamped; where they moved since the plan, the delivered one is the fact
    const stand = p.packs.length ? standSincePreview(p.preview, p.receipt, p.packs) : null;
    const standOf = (id: string) => stand?.packs.find((r) => r.id === id);
    packCell.append(el("div", "fdproofnote", `zugestellt ${new Date(p.receipt.at).toLocaleTimeString("de-DE")} · ${headSay(stand, p.receipt.head)}`));
    for (const pack of p.receipt.selected) {
      const item = el("div", "fdreceiptpack");
      item.append(el("div", "fdmono", pack.id));
      if (pack.useWhen) item.append(el("div", "fdproofnote", pack.useWhen));
      const anchors = Array.isArray(pack.anchors) ? pack.anchors.map((a) => `${a.path} | ${a.anchor}`)
        : pack.anchors?.privateSourceId ? [pack.anchors.privateSourceId] : [];
      for (const anchor of anchors) item.append(el("div", "fdmono", anchor));
      item.append(el("div", "fdmono", pack.sourceHash ? `Hash: ${pack.sourceHash.slice(0, 12)}` : "Hash: nicht gemeldet"));
      if (!anchors.length || !pack.sourceHash) item.classList.add("warn");
      if (packIdFassung(pack.id) !== null) item.append(el("div", "fdproofnote", fassungSay(pack.id)));
      if (pack.private) item.append(el("div", "fdproofnote", `Urteil: ${pack.private.verdict} · Fassung: ${pack.private.version ?? "nicht gemeldet"}`));
      const r = standOf(pack.id);
      if (r) item.append(el("div", `fdproofnote${r.stand === "same" ? "" : " warn"}`, standSay(r.stand, r.preview, r.delivered)));
      packCell.append(item);
    }
    for (const r of stand?.packs.filter((x) => x.stand === "not-delivered") ?? []) {
      packCell.append(el("div", "warn", `nicht zugestellt: ${r.id}${r.why ? ` — ${r.why}` : " — der Beleg nennt keinen Grund"}`));
      packCell.classList.add("warn");
    }
    const extra = stand?.packs.filter((x) => x.stand === "extra") ?? [];
    if (extra.length) { packCell.append(el("div", "warn", `Abweichung: zusätzliche Packs ${extra.map((x) => x.id).join(", ")}`)); packCell.classList.add("warn"); }
    if (p.packs.length) packCell.append(el("div", "fdproofnote", "Zugestellt heißt: der Zeiger stand im Brief. Ob er gelesen wurde, sagt kein Beleg."));
    if (p.receiptCount > 1) packCell.append(el("div", "fdproofnote", `${p.receiptCount} Startbelege — der jüngste gilt.`));
  }
  if (p.receiptError) packCell.append(el("div", "fdproofnote", p.receiptError));
  // E38/E39: THE PROJECT VIEWS this start granted — none, by construction — read back FRESH at the
  // occupant the start produced. Below the table the same block as in the session's Info, as an
  // optional step of its own: a failure there is said in the block, the status line stays.
  let step: HTMLElement | null = null;
  if (row && !p.stale) {
    const gr = proofGrantRow(p.result.slot, row.openedAt!, !!row.worktree, () => { if (S === s) renderProof(); });
    const r = el("div", "fdproofrow"); r.dataset.field = "Projektsichten";
    r.dataset.state = gr.warn ? "missing" : "same";
    const req = el("div", "fdrequested", "keine");
    req.append(el("span", "fdproofnote", "der Start vergibt keine"));
    const got = el("div", `fdactual${gr.warn ? " warn" : ""}`);
    got.append(gr.observed);
    r.append(el("span", "fdproofkey", "Projektsichten"), req, got);
    table.append(r);
    if (gr.step) {
      step = el("div", "fdproofgrant");
      step.append(lab("Projektsichten · optional — die Session läuft auch ohne"), gr.step);
    }
  }
  detail.append(table);
  if (step) detail.append(step);
  s.shell.foot.replaceChildren();
  // no session started: there is nothing to go to, so the button is not offered at all
  if (!row) {
    if (!s.shell.root.contains(document.activeElement)) s.shell.detail.focus({ preventScroll: true });
    return;
  }
  const go = btn("fdgo", "Zur Session");
  go.disabled = p.stale;
  go.onclick = () => {
    const current = fleet.find((r) => r.id === p.result.slot);
    if (!row || current?.openedAt !== row.openedAt || !current?.cwd) { p.stale = true; renderProof(); return; }
    closeFounding(); showSlot(p.result.slot);
  };
  s.shell.foot.append(el("div", "fdsaycol"), go);
}
