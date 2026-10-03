// THE FOUNDING WINDOW — what a click on a free place in the bar opens, and what ⎇+ on a session
// opens (Neuentwurf 2026-10-01 with the owner, Program Oberflaeche 0d51b4d4: „[Zitat entfernt]“
// ). It replaces the place-list window of 2026-09-29.
//
// ONE COLUMN, FOUR FIELDS, read top to bottom: ORT (the repo, or the worktree a lane gets — named
// or auto-named), ROLLE (Leer, Lane, Orchestratorin, MAIN), PROFIL (agent, model, effort,
// container) and KONTEXT (what the agent is handed). The foot says in one sentence what will start
// and holds the one button. Nothing replaces the page: a state change repaints its field.
//
// MAIN REPLACES THE STEWARD CARD (owner 2026-10-02: „[Zitat entfernt]“). A MAIN is
// founded for exactly one ACTIVE Program over its existing owner door, POST
// /api/programs/:id/bootstrap-main — the same door the Program detail in src/queue.ts uses. The
// window reads GET /api/programs fresh, offers only a Program without a living MAIN, shows the
// others greyed with their reason, and says "unbekannt" where the row does not carry the fact.
// The door takes cwd (the Ort), harness, model and effort; no packs and no container — the
// server builds the Program's own founding brief and picks the free MAIN place itself.
//
// THE ROLE PRESELECTS THE CONTEXT, VISIBLY. Each role carries a preset over the founding plan
// (all fitting packs, none, or none plus a few). Choosing a role applies it, and the packs that
// arrive light up while the ones that leave strike through, with one line naming the difference.
// "Rollen vergleichen" lays the presets side by side and lets the owner redraw them.
//
// A LANE IS A WORKTREE. The Lane role and the "Neuer Worktree"/"Worktree fortsetzen" places are
// one choice seen from two fields: picking one moves the other, and the window says so.
//
// It is a src/shell.ts#openShell window without a list (the #shell-idee precedent): the shell
// brings the dimmed backdrop and Esc/✕/click-beside closing. Enter outside a control starts; the
// start button holds the focus when the window opens, so "open, Enter" is a plain founding.
//
// Doors, all existing: /api/dirs, /api/dirinfo, /api/founding-plan, POST /api/slots/:id/open and
// /open-worktree for a clicked free place, POST /api/lanes for ⎇+ (with its parent) and for an
// attach.
import {
  agentHarnesses, api, baseName, containerDefaults, defaultModel, el, fleet, harnesses, isMobile,
  laneBandNames, loadHarnesses, modelNotice, post, revealStartedSlot, setDrawer, showSlot, SKEW_NOTE, stacksOf,
  startSession, startWorktree, type DirInfoResp, type HarnessInfo, type SlotInfo, type SpawnBody, type StartResult,
} from "./client";
import { MODEL_DEFAULTS } from "../model-register";
import { matchTree } from "./filetree";
import { Flakes } from "./flakes";
import { icon } from "./icons";
import { projectHue } from "./marks";
import { modelLabel } from "./modelname";
import { normalizeRolePresets, packIdFassung, standSincePreview, type FoundingPlanOmission, type FoundingPlanPack,
  type FoundingRole, type LaneAnchor, type PackAnchors, type PackStand, type RolePreset } from "./protocol";
import { openShell, type Shell } from "./shell";
import { dropGrantMount, foundingRights, proofGrantRow } from "./rights";

// the window's roles. "main" is no stored preset role: bootstrap-main carries no packs, so it has
// no preset to redraw, and the server's preset store (src/protocol.ts#FOUNDING_ROLES) never sees it
type Role = Exclude<FoundingRole, "steward"> | "main";
const isWindowRole = (r: string): r is Role => r === "leer" || r === "lane" || r === "orch" || r === "main";
type Mode = "repo" | "new" | "old";

// `say` is the card's sentence (G0.5, owner words); `why` is the compare table's last row
const ROLES: { id: Role; name: string; glyph: string; say: string; why: string }[] = [
  { id: "leer", name: "Leer", glyph: "○", say: "Ohne Rolle. Nur Ort, Agent und was du selbst mitgibst.",
    why: "Nichts vorgewählt." },
  { id: "lane", name: "Lane", glyph: "⎇", say: "Arbeitet einen Auftrag im eigenen Worktree ab und beweist ihn.",
    why: "Alles, was zu diesem Start passt." },
  { id: "orch", name: "Orchestratorin", glyph: "◎", say: "Hält das Portfolio, schärft Aufträge, verteilt Arbeit. Landet nicht selbst.",
    why: "Ihre Rollenkarte trägt die Zeiger — Packs wären doppelt." },
  { id: "main", name: "MAIN", glyph: "◆", say: "Führt ein aktives Program: schneidet Karten, treibt Lanes, landet.",
    why: "Der Server baut ihren Gründungsbrief — Packs gehen nicht mit." },
];

// A ROLE'S OWN PROFILE (owner 02.10.: Effort stood on „[Zitat entfernt]“ for a MAIN). The MAIN card
// fills Agent, Modell and Effort with the MAIN default of the model register
// (model-register.ts#MODEL_DEFAULTS.main) — read from there, never copied into this window. Only
// what the register's agent supports is filled, and an agent this machine does not run fills
// nothing. Leaving the role takes back exactly what it filled, unless the owner changed it since.
type RoleProfile = { readonly harness: string; readonly id: string; readonly effort: string | null };
const ROLE_PROFILE: Partial<Record<Role, RoleProfile>> = { main: MODEL_DEFAULTS.main };
type Profile = { harness: string | null; model: string; effort: string };

// the label the server keys a role off: isOrchestratorLabel (word boundary). A MAIN gets hers
// from bootstrap-main ("Program-MAIN: <title>"), never from this window.
const roleLabel = (r: Role): string | undefined => r === "orch" ? "Orchestrator" : undefined;

// A ROLE'S PRESET over the founding plan (shape: src/protocol.ts#RolePreset). These are the
// built-in ones; the owner's redrawn ones come from GET /api/role-presets and win per role. Read
// against the plan of THIS start, so an id the plan omits never switches on.
type Preset = RolePreset;
const PRESET_DEFAULT: Record<Role, Preset> = {
  leer: { base: "none", plus: [], minus: [] },
  lane: { base: "all", plus: [], minus: [] },
  orch: { base: "none", plus: [], minus: [] },
  main: { base: "none", plus: [], minus: [] },
};
// a stored preset of a role this window no longer offers (the Steward's) rides along unchanged on
// every save — the window drops a card, never the owner's stored choice
let presetsForeign: Record<string, Preset> = {};
let presets: Record<Role, Preset> = clonePresets(PRESET_DEFAULT);
function clonePresets(p: Record<Role, Preset>): Record<Role, Preset> {
  const out = {} as Record<Role, Preset>;
  for (const r of ROLES) out[r.id] = { base: p[r.id].base, plus: [...p[r.id].plus], minus: [...p[r.id].minus] };
  return out;
}
const samePreset = (a: Preset, b: Preset): boolean =>
  a.base === b.base && [...a.plus].sort().join() === [...b.plus].sort().join() && [...a.minus].sort().join() === [...b.minus].sort().join();
const customized = (r: Role): boolean => !samePreset(presets[r], PRESET_DEFAULT[r]);
function presetHas(p: Preset, id: string): boolean {
  return p.base === "all" ? !p.minus.includes(id) : p.plus.includes(id);
}

// the founding plan's omission reasons are a closed vocabulary (context-plan.ts
// CONTEXT_PLAN_OMISSION_REASONS); the window says each in owner words and keeps the raw one behind
// "intern:" in the tooltip — an unknown future reason is shown raw rather than hidden
const OMIT_SAY: Record<string, string> = {
  "manifest-invalid": "das Pack-Verzeichnis des Repos ist nicht lesbar",
  "source-unavailable": "seine Quellen liegen nicht in diesem Repo",
  "status-not-active": "abgeschaltet",
  "harness-unsupported": "nicht für diesen Agenten",
  "mode-unsupported": "nicht für diese Rolle",
  "trigger-not-matched": "passt nicht zu diesem Start",
  "capability-missing": "braucht eine Fähigkeit, die hier fehlt",
  "program-complete": "sein Program ist abgeschlossen",
};

// where the window was opened from: a clicked free place, or ⎇+ on a session (its repo and the
// session occupant the lane hangs under — never the slot alone, slots recycle)
type Entry = { kind: "slot"; slot: number } | { kind: "lane"; repo: string; parent?: LaneAnchor; from: string };

interface Repo { repo: string; name: string; slots: SlotInfo[] }
// the plan route's answer (shapes: src/protocol.ts#FoundingPlanPack); head and plannedAt are the
// PREVIEW's source state, which the start receipt is later held against
interface Plan { head?: string; branch?: string | null; harness?: string; plannedAt?: number; selected: FoundingPlanPack[]; omitted: FoundingPlanOmission[] }
interface DirList { path: string; parent: string | null; dirs: string[]; repos?: string[]; capped?: boolean; total?: number }
interface FindHit { path: string; name: string; repo: boolean }
// one Program as the MAIN choice reads it off GET /api/programs. `state` is the server's own
// health.occupancy (the same comparison bootstrap-main's live guard makes); a row whose founding
// marker stands, or that carries no readable occupancy, is "unknown" — never guessed free.
type ProgState = "free" | "stale" | "live" | "unknown";
interface ProgRow { id: string; title: string; state: ProgState; slot: number | null }
type Pop = "place" | "harness" | "model" | "effort" | "container" | "add";

interface State {
  shell: Shell;
  flakes: Flakes;
  entry: Entry;
  role: Role;
  mode: Mode;
  name: string;                         // the worktree's name; empty = the server names it
  note: string | null;                  // what a coupled choice moved, said under the place
  repos: Repo[];
  view: "repos" | "folders";
  place: string | null;
  info: DirInfoResp | null; infoErr: string | null; infoSeq: number;
  plan: Plan | null; planErr: string | null; planFor: string | null; planSeq: number;
  planHarness: string | null;           // the agent the last read plan was made for — a change re-plans visibly
  packs: Set<string>;                   // switched-on pack ids — empty sends no packs at all
  touched: Map<string, boolean>;        // the owner's own switches against the role's preset
  presetDue: boolean;                   // a role change waits for the plan it applies to
  fresh: Set<string>; gone: string[];   // the last change, for one paint of light and strike
  delta: { plus: string[]; minus: string[]; why: string } | null;
  compare: boolean;
  listOpen: boolean;                    // every pack of this start as a row, on demand
  srcOpen: Set<string>;                 // the packs whose sources, hash and plan HEAD are unfolded in the list
  dropped: { id: string; why: string }[]; // packs the last plan switched off, each with the plan's reason
  presetState: "idle" | "saving" | "saved" | "error";
  presetNote: string | null;            // why the stored presets could not be read or written
  orphan: string | null;
  progs: ProgRow[] | null; progOther: number; progErr: string | null; progSeq: number;
  program: string | null;               // the Program the MAIN is founded for
  harness: string | null; model: string; effort: string; container: string; containerContext: string;
  profileFill: (Profile & { before: Profile }) | null; // what the role's own profile filled, and what stood before
  dir: string; list: DirList | null; listErr: string | null; listSeq: number;
  find: string; hits: FindHit[] | null; findPartial: boolean; findSeq: number;
  findTimer: ReturnType<typeof setTimeout> | null;
  paintFolders: (() => void) | null;    // the open folder list repaints alone, so typing keeps focus
  error: string | null;
  busy: boolean;
  proof: StartProof | null;
  pop: Pop | null;
  restore: HTMLElement | null;
  teardown: () => void;
  // the four fields and the foot, each repainted on its own
  fPlace: HTMLElement; fRole: HTMLElement; fProfile: HTMLElement; fContext: HTMLElement;
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

function chosenHarness(): HarnessInfo | null {
  const agents = agentHarnesses();
  return harnesses.find((h) => h.id === S?.harness) ?? agents.find((h) => h.default) ?? null;
}

const isLaneEntry = (s: State): boolean => s.entry.kind === "lane";

// the branch a typed name becomes: the server's own prefix and day stamp, the name as a slug.
// Empty stays empty — the server then names the lane itself (createWorktree).
function branchFor(name: string): string {
  const slug = name.trim().toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  if (!slug) return "";
  const d = new Date();
  const stamp = `${String(d.getFullYear() % 100).padStart(2, "0")}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `fleet/${stamp}-${slug}`;
}

// what this founding sends. Absent fields are the door's defaults; `packs` only when at least one
// is on, so a founding without packs is byte-identical to one from before packs existed.
function foundingBody(): SpawnBody {
  const s = S!;
  return {
    ...(s.harness ? { harness: s.harness } : {}),
    ...(s.model ? { model: s.model } : {}),
    ...(s.effort ? { effort: s.effort } : {}),
    ...(s.container ? { container: s.container } : {}),
    ...(s.containerContext ? { containerContext: s.containerContext } : {}),
    ...(s.packs.size ? { packs: [...s.packs] } : {}),
  };
}

// what bootstrap-main reads: cwd plus the three spawn fields. No packs, no container and no label —
// the door builds the Program's brief, runs without a box and names the slot itself.
function mainSpawn(): SpawnBody {
  const s = S!;
  return {
    ...(s.harness ? { harness: s.harness } : {}),
    ...(s.model ? { model: s.model } : {}),
    ...(s.effort ? { effort: s.effort } : {}),
  };
}
const mainBody = (): SpawnBody & { cwd: string } => ({ cwd: S?.place ?? "", ...mainSpawn() });

// why the button cannot start right now — null when it can. Said next to the button, never only
// as a greyed-out control.
function blocker(): string | null {
  const s = S!;
  if (!s.place) return "Wähle, wo die Session laufen soll.";
  if (s.role === "main") {
    if (s.progErr) return "Die Programs sind nicht lesbar — ohne sie wird keine MAIN gegründet.";
    if (!s.progs) return "Die Programs werden gelesen …";
    const p = s.progs.find((x) => x.id === s.program);
    if (!p) return s.progs.some(pickable) ? "Wähle das Program, dessen MAIN du gründest." : "Kein aktives Program ohne lebende MAIN.";
    if (!pickable(p)) return `„${p.title}“ ist nicht mehr wählbar: ${progSays(p)}.`;
    return null;
  }
  if (s.mode !== "repo") {
    if (s.info && !s.info.git) return "Ein Worktree braucht ein Git-Repo.";
    if (chosenHarness()?.allowsLanes === false) return `${chosenHarness()!.id} läuft nur als Haupt-Session, nicht als Lane.`;
  }
  if (s.mode === "new" && s.name.trim() && !branchFor(s.name)) return "Der Name braucht mindestens einen Buchstaben oder eine Ziffer.";
  if (s.mode === "old" && !s.orphan) return "Wähle den Worktree, der weiterlaufen soll.";
  if (s.packs.size) {
    if (s.planErr) return "Die gewählten Packs können nicht geprüft werden: " + s.planErr;
    if (!s.plan || s.planFor !== planKey()) return "Der Plan für diesen Start wird gelesen …";
    if ([...s.packs].some((id) => !s.plan!.selected.some((p) => p.id === id)))
      return "Ein gewähltes Pack passt nicht mehr zu diesem Start.";
  }
  return null;
}

// --- open / close --------------------------------------------------------------------------------

export function openPicker(slotId: number) {
  open({ kind: "slot", slot: slotId });
}

// ⎇+ on a session (or the board's "New lane"): the same window, the repo and the lane preset
export function openLaneFounding(repo: string, parent?: LaneAnchor) {
  const names = barNames();
  const from = parent ? fleet.find((x) => x.id === parent.slot) : undefined;
  open({ kind: "lane", repo, parent, from: from ? barName(names, from) : "" });
}

function open(entry: Entry) {
  setDrawer(false);
  closeFounding();
  const restore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const laneEntry = entry.kind === "lane";
  const shell = openShell({
    id: "found",
    title: laneEntry ? "Neue Lane" : "Neue Session",
    subtitle: entry.kind === "lane"
      ? `${entry.from ? `von ${entry.from} · ` : ""}${baseName(entry.repo)} · nächster freier Platz`
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
  const fPlace = el("section", "fdsec"), fRole = el("section", "fdsec"),
    fProfile = el("section", "fdsec"), fContext = el("section", "fdsec");
  shell.detail.replaceChildren(fPlace, fRole, fProfile, fContext);
  // focusable without a tab stop: a click on empty space lands here, and Enter then starts
  shell.detail.tabIndex = -1;
  const repos = repoList();
  S = {
    shell, flakes, entry, role: laneEntry ? "lane" : "leer", mode: laneEntry ? "new" : "repo", name: "", note: null,
    repos, view: repos.length ? "repos" : "folders", place: null,
    info: null, infoErr: null, infoSeq: 0, plan: null, planErr: null, planFor: null, planSeq: 0, planHarness: null,
    packs: new Set(), touched: new Map(), presetDue: true, fresh: new Set(), gone: [], delta: null, compare: false, listOpen: false, srcOpen: new Set(), dropped: [], presetState: "idle", presetNote: null,
    orphan: null, progs: null, progOther: 0, progErr: null, progSeq: 0, program: null, harness: null, model: "", effort: "", container: "", containerContext: "",
    profileFill: null, dir: "~", list: null, listErr: null, listSeq: 0, find: "", hits: null, findPartial: false, findSeq: 0,
    findTimer: null, paintFolders: null, error: null, busy: false, proof: null, pop: null, restore, teardown: () => {},
    fPlace, fRole, fProfile, fContext,
  };
  // the popovers own Escape, the arrows and Enter while one is open. WINDOW capture runs before
  // the shell's document-capture handler, so an Escape here closes the popover and never the window.
  const onKey = (e: KeyboardEvent) => {
    const s = S;
    if (!s?.pop) return;
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
    const sw = s.shell.root.querySelector(`[data-pop="${s.pop}"]`);
    if (pop?.contains(e.target) || sw?.contains(e.target)) return;
    closePop(false);
  };
  // Enter outside a control starts — the composer's grammar; ⌘/Ctrl+Enter starts from anywhere.
  // Tab stays inside the window: past the last control it wraps to the first, and back.
  const onWinKey = (e: KeyboardEvent) => {
    const s = S;
    if (!s) return;
    if (e.key === "Tab") {
      const all = [...s.shell.root.querySelectorAll<HTMLElement>("button:not(:disabled), input, [tabindex='0']")]
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
    void start();
  };
  window.addEventListener("keydown", onKey, true);
  shell.root.addEventListener("pointerdown", onDown, true);
  // capture: the app's own keyboard (the composer, the panes) must not see an Enter this window took
  window.addEventListener("keydown", onWinKey, true);
  // the pack line folds against its width, so a resized window refits it
  const onResize = () => { const line = S?.fContext.querySelector<HTMLElement>(".fdctx:not(.all)"); if (line) fitLine(line); };
  window.addEventListener("resize", onResize);
  S.teardown = () => {
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("keydown", onWinKey, true);
    window.removeEventListener("resize", onResize);
  };
  if (entry.kind === "lane") choosePlace(entry.repo);
  else if (repos.length) choosePlace(repos[0]!.repo);
  else { renderAll(); void loadDir("~"); }
  void loadPresets();
  // fetch-once: the catalogue is needed exactly when a founding is being composed
  void loadHarnesses().then(() => { if (S) { renderProfile(); renderContext(); renderFoot(); } });
  if (!isMobile()) S.shell.foot.querySelector<HTMLElement>(".fdgo")?.focus({ preventScroll: true });
}

export function closeFounding() {
  S?.shell.close();
}

function renderAll() {
  // after a start the window shows its receipt; the four fields are no longer on screen
  if (S?.proof) { renderProof(); return; }
  renderPlace();
  renderRole();
  renderProfile();
  renderContext();
  renderFoot();
}

function fieldHead(sec: HTMLElement, title: string, hint: string) {
  const h = el("div", "fdlab");
  h.append(el("span", "fdlabt", title), el("span", "fdlabh", hint));
  sec.append(h);
}

// --- ORT ------------------------------------------------------------------------------------------

function renderPlace() {
  const s = S;
  if (!s) return;
  const sec = s.fPlace;
  sec.replaceChildren();
  fieldHead(sec, "Ort", "Wo der Agent arbeitet.");
  const body = el("div", "fdbody");
  sec.append(body);
  const laneEntry = isLaneEntry(s);

  const card = btn("fdplace");
  card.dataset.pop = "place";
  card.setAttribute("aria-expanded", String(s.pop === "place"));
  card.disabled = laneEntry;
  card.title = laneEntry ? "Das ⎇+ startet die Lane im Repo der Session, an der es hängt." : "Ort wechseln — Repos mit Sessions oder jeder Ordner auf diesem Rechner.";
  const dot = el("i", "fddot");
  if (s.place) dot.style.setProperty("--proj-h", String(projectHue(s.place)));
  const names = el("span", "fdpn");
  names.append(el("span", "fdpname", s.place ? baseName(s.place) || s.place : "Ort wählen"),
    el("span", "fdppath", s.place ? tilde(s.place) : "noch nichts gewählt"));
  const facts = el("span", "fdpfacts");
  const info = s.info;
  if (s.infoErr) facts.append(el("span", "warn", "nicht lesbar"));
  else if (!info) facts.append(el("span", "", s.place ? "liest …" : ""));
  else if (!info.git) facts.append(el("span", "", "kein Git-Repo"));
  else {
    facts.append(el("span", "mono", info.branch ?? "ohne Branch"));
    facts.append(info.dirty ? el("span", "warn", `${info.dirty} ungesichert`) : el("span", "ok", "sauber"));
    if (typeof info.ahead === "number" && typeof info.behind === "number" && (info.ahead || info.behind))
      facts.append(el("span", "mono", `↑${info.ahead} ↓${info.behind}`));
  }
  if (!laneEntry) facts.append(icon("chevron"));
  card.append(dot, names, facts);
  card.onclick = () => togglePop("place");
  body.append(card);
  if (s.pop === "place") body.append(placePop());
  if (s.infoErr) body.append(el("div", "fdnote warn", s.infoErr));

  // who works here, by their names in the bar
  const here = s.place ? fleet.filter((x) => x.cwd && (x.repo ?? x.cwd) === s.place) : [];
  if (here.length) {
    const row = el("div", "fdhere");
    row.append(el("span", "", "Hier arbeiten"));
    const bn = barNames();
    for (const x of here.slice(0, 10)) {
      const chip = el("span", "fdchip mono", barName(bn, x));
      const meta = [x.model ? modelLabel(x.model) : "", x.effort ?? ""].filter(Boolean).join(" · ");
      chip.title = `${x.label || baseName(x.cwd || "")}${meta ? ` — ${meta}` : ""}`;
      row.append(chip);
    }
    if (here.length > 10) row.append(el("span", "", `+${here.length - 10}`));
    body.append(row);
  }

  if (!laneEntry) {
    const seg = el("div", "fdseg");
    seg.setAttribute("role", "radiogroup");
    seg.setAttribute("aria-label", "Arbeitsort");
    const noGit = !!info && !info.git;
    for (const [m, label, tip] of [
      ["repo", "Direkt im Repo", "Der Agent arbeitet im Ordner selbst."],
      ["new", "Neuer Worktree", "Eine Lane: eigener Worktree auf frischem Branch, wird später gelandet."],
      ["old", "Worktree fortsetzen", "Setzt einen liegengebliebenen Worktree auf diesen Slot — die Arbeit darauf bleibt."],
    ] as [Mode, string, string][]) {
      const b = btn(`fdsegb${s.mode === m ? " on" : ""}`, label);
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(s.mode === m));
      b.disabled = m !== "repo" && noGit;
      b.title = b.disabled ? "Ein Worktree braucht ein Git-Repo." : tip;
      b.onclick = () => setMode(m);
      seg.append(b);
    }
    body.append(seg);
  }
  if (s.note) body.append(el("div", "fdcouple", s.note));

  if (s.mode === "new") {
    const field = el("label", "fdname");
    field.append(el("span", "", "Name"));
    const inp = el("input", "") as HTMLInputElement;
    inp.type = "text";
    inp.spellcheck = false;
    inp.autocomplete = "off";
    inp.value = s.name;
    inp.placeholder = "leer lassen = automatischer Name";
    inp.oninput = () => { s.name = inp.value; paintBranch(); renderFoot(); };
    field.append(inp);
    const branch = el("div", "fdbranch mono");
    const paintBranch = () => {
      const b = branchFor(s.name);
      branch.textContent = s.name.trim() && !b ? "Dieser Name ergibt keinen Branch."
        : `Branch ${b || "fleet/<Datum>-<Zufall>, automatisch"}${info?.branch ? ` · zweigt vom Integrationsbranch ab` : ""}`;
    };
    paintBranch();
    body.append(field, branch);
  }
  if (s.mode === "old" && info?.git) {
    const list = el("div", "fdorphans");
    const orphans = info.orphans ?? [];
    if (!orphans.length) list.append(el("div", "fdnote", "Keine — jeder Worktree dieses Repos hat einen Slot."));
    for (const o of orphans) {
      const on = s.orphan === o.path;
      const b = btn(`fdorph${on ? " on" : ""}`);
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(on));
      b.append(el("i", "fdradio"), el("span", "mono", baseName(o.path)), el("span", "fdmeta", o.branch || "ohne Branch"));
      b.title = s.entry.kind === "slot" ? `Diesen Worktree auf Slot ${s.entry.slot} setzen.` : "";
      b.onclick = () => { s.orphan = on ? null : o.path; renderPlace(); renderFoot(); };
      list.append(b);
    }
    body.append(list);
  }
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
        el("span", "fdprr mono", who.length > 4 ? `${who.slice(0, 4).join(" ")} +${who.length - 4}` : who.join(" ")));
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
    back.onclick = () => { s.view = "repos"; s.find = ""; s.hits = null; renderPlace(); focusPop(); };
    nav.append(back);
  }
  const up = btn("fdnavb", "↑");
  up.title = "Eine Ebene höher.";
  up.disabled = !s.list?.parent;
  up.onclick = () => { if (s.list?.parent) void loadDir(s.list.parent); };
  nav.append(up, el("span", "fdcwd mono", tilde(s.list?.path ?? s.dir)));
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
    row.append(icon("folder"), el("span", "fdprn", name), el("span", "fdmeta", sub), el("span", "fdprr mono", repo ? "git" : ""));
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

function focusPop() {
  const s = S;
  if (!s) return;
  s.shell.root.querySelector<HTMLElement>(".fdpop input.fdfind, .fdpop .fdprow.on, .fdpop .fdprow, .fdpop input")?.focus({ preventScroll: true });
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
  renderPlace();
  focusPop();
  const res = await api(`/api/dirs?path=${encodeURIComponent(path)}`);
  if (S !== s || seq !== s.listSeq) return;
  const j = (await res.json().catch(() => null)) as (DirList & { error?: string }) | null;
  if (S !== s || seq !== s.listSeq) return;
  if (!res.ok || !j || !Array.isArray(j.dirs)) s.listErr = j?.error ?? `Der Server antwortete ${res.status} für diesen Ordner.`;
  else { s.list = j; s.dir = j.path; }
  if (s.pop === "place") { renderPlace(); focusPop(); }
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
    s.plan = null;
    s.planErr = null;
    s.planFor = null;
    s.packs = new Set();
    s.touched.clear();
    s.presetDue = true;
    s.delta = null;
    s.orphan = null;
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
  // a folder without git has no worktree to found and no plan to read
  if (!info.git && s.mode !== "repo" && !isLaneEntry(s)) { s.mode = "repo"; if (s.role === "lane") s.role = "leer"; }
  renderAll();
}

// --- ROLLE ----------------------------------------------------------------------------------------

function renderRole() {
  const s = S;
  if (!s) return;
  const sec = s.fRole;
  sec.replaceChildren();
  fieldHead(sec, "Rolle", "Wählt den Kontext vor — du kannst alles ändern.");
  const grid = el("div", "fdroles");
  grid.setAttribute("role", "radiogroup");
  grid.setAttribute("aria-label", "Rolle");
  for (const r of ROLES) {
    const on = s.role === r.id;
    const b = btn(`fdrole${on ? " on" : ""}`);
    b.dataset.role = r.id;
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(on));
    b.disabled = isLaneEntry(s) && r.id !== "lane";
    b.title = b.disabled ? "⎇+ startet eine Lane — andere Rollen über einen freien Slot." : r.say;
    const head = el("span", "fdrn");
    head.append(el("span", "fdglyph", r.glyph), el("span", "", r.name));
    b.append(head, el("span", "fdrs", r.say), el("span", "fdrk mono", `${roleBrings(r.id)}${customized(r.id) ? " · angepasst" : ""}`));
    b.onclick = () => setRole(r.id);
    grid.append(b);
  }
  sec.append(grid);
  if (s.role === "main") sec.append(progList());
}

// --- the MAIN's Program -----------------------------------------------------------------------------

const pickable = (p: ProgRow): boolean => p.state === "free" || p.state === "stale";
function progSays(p: ProgRow): string {
  if (p.state === "live") return `MAIN lebt${p.slot !== null ? ` · Slot ${p.slot}` : ""}`;
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
  const box = el("div", "fdprogs");
  const head = el("div", "fdproghead");
  head.append(el("span", "fdlabt", "Program"));
  const free = s.progs?.filter(pickable).length ?? 0;
  head.append(el("span", "fdmeta", s.progs ? `${s.progs.length} aktiv · ${free} ohne lebende MAIN` : s.progErr ? "nicht lesbar" : "liest …"));
  const again = btn("fdghost", "Neu lesen");
  again.title = "GET /api/programs noch einmal lesen.";
  again.onclick = () => { void loadProgs(); };
  head.append(again);
  box.append(head);
  if (s.progErr) { box.append(el("div", "fdnote warn", s.progErr)); return box; }
  if (!s.progs) return box;
  const list = el("div", "fdproglist");
  list.setAttribute("role", "radiogroup");
  list.setAttribute("aria-label", "Program der MAIN");
  for (const p of s.progs) {
    const on = s.program === p.id;
    const b = btn(`fdprog${on ? " on" : ""}`);
    b.dataset.program = p.id;
    b.dataset.state = p.state;
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(on));
    b.disabled = !pickable(p);
    b.title = progTip(p);
    b.append(el("i", "fdradio"), el("span", "fdprogt", p.title), el("span", `fdpst ${p.state}`, progSays(p)));
    b.onclick = () => { s.program = on ? null : p.id; s.error = null; renderRole(); renderProfile(); renderFoot(); };
    list.append(b);
  }
  if (!s.progs.length) list.append(el("div", "fdnote", "Kein aktives Program — eine MAIN gehört immer zu einem."));
  box.append(list);
  if (s.progOther) box.append(el("div", "fdnote", `${s.progOther} weitere nicht aktiv — bootstrap-main nimmt nur ein aktives Program.`));
  return box;
}

// a fresh read every time the MAIN card is chosen and after every answer of the door: whether a
// MAIN lives is a fact that moves, and a cached one would offer a founding the server refuses
async function loadProgs() {
  const s = S;
  if (!s) return;
  const seq = ++s.progSeq;
  s.progs = null;
  s.progErr = null;
  if (s.role === "main") { renderRole(); renderFoot(); }
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
  renderRole();
  renderFoot();
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

// the card's foot: what the role hands over HERE, counted against this start's plan
function roleBrings(r: Role): string {
  const s = S!;
  if (r === "orch") return "Rollenkarte";
  if (r === "main") return "Gründungsbrief";
  const p = presets[r];
  if (!s.plan) return p.base === "all" ? "alle passenden Packs" : p.plus.length ? `${p.plus.length} Packs` : "keine Packs";
  const n = s.plan.selected.filter((x) => presetHas(p, x.id)).length;
  return n ? `${n} ${n === 1 ? "Pack" : "Packs"}` : "keine Packs";
}

function setRole(r: Role, why?: string) {
  const s = S;
  if (!s || (s.role === r && why === undefined)) return;
  const prev = s.role;
  s.role = r;
  s.error = null;
  s.touched.clear();
  s.note = why ?? null;
  // the lane role and a worktree are one choice: choosing one moves the other, said out loud
  if (r === "lane" && s.mode === "repo") { s.mode = "new"; s.note = "Ort → Neuer Worktree: eine Lane arbeitet im eigenen Worktree."; }
  if (r !== "lane" && s.mode !== "repo") { s.mode = "repo"; s.note = "Ort → Direkt im Repo: nur eine Lane bekommt einen Worktree."; }
  applyPreset(`${ROLES.find((x) => x.id === r)!.name} statt ${ROLES.find((x) => x.id === prev)!.name}`);
  fillProfile();
  renderAll();
  if (r === "main") void loadProgs();
}

// the role's own profile (ROLE_PROFILE) over Agent, Modell and Effort; see there
function fillProfile() {
  const s = S!;
  const f = s.profileFill;
  if (f) {
    if (s.harness === f.harness && s.model === f.model && s.effort === f.effort) {
      s.harness = f.before.harness; s.model = f.before.model; s.effort = f.before.effort;
    }
    s.profileFill = null;
  }
  const want = ROLE_PROFILE[s.role];
  const h = want ? agentHarnesses().find((a) => a.id === want.harness) : undefined;
  if (!want || !h) return;
  const before = { harness: s.harness, model: s.model, effort: s.effort };
  s.harness = h.default ? null : h.id;
  s.model = h.supports.model ? want.id : "";
  s.effort = h.supports.effort && want.effort && h.effortLevels.includes(want.effort) ? want.effort : "";
  s.profileFill = { harness: s.harness, model: s.model, effort: s.effort, before };
}
// "MAIN-Standard" where a profile field still holds what the role filled
function filled(which: "model" | "effort"): boolean {
  const s = S;
  return !!s?.profileFill?.[which] && s[which] === s.profileFill[which];
}

function setMode(m: Mode) {
  const s = S;
  if (!s || s.mode === m) return;
  s.mode = m;
  s.error = null;
  if (m !== "repo" && s.role !== "lane") { setRole("lane", "Rolle → Lane: ein Worktree ist eine Lane."); return; }
  if (m === "repo" && s.role === "lane") { setRole("leer", "Rolle → Leer: direkt im Repo läuft keine Lane."); return; }
  s.note = null;
  if (m === "old") { s.touched.clear(); applyPreset(""); }
  renderAll();
}

// THE PRESET MEETS THE PLAN. With the plan of this start at hand, the switches become the role's
// preset plus the owner's own touches, and the change is kept for one paint (light in, strike
// out). Without it, the preset waits for loadPlan — nothing switches against a plan nobody read.
function applyPreset(why: string) {
  const s = S!;
  if (!s.plan || s.planFor !== planKey()) { s.presetDue = true; s.delta = why ? { plus: [], minus: [], why } : null; return; }
  s.presetDue = false;
  const before = s.packs;
  const next = new Set<string>();
  if (s.mode !== "old") {
    for (const p of s.plan.selected) {
      const on = s.touched.get(p.id) ?? presetHas(presets[s.role], p.id);
      if (on) next.add(p.id);
    }
  }
  s.packs = next;
  const plus = [...next].filter((x) => !before.has(x));
  const minus = [...before].filter((x) => !next.has(x));
  s.dropped = minus.flatMap((id) => {
    const o = s.plan!.omitted.find((x) => x.id === id);
    return o ? [{ id, why: `${OMIT_SAY[o.reason] ?? o.reason}${o.harnesses?.length ? ` (nur ${o.harnesses.join(", ")})` : ""}` }] : [];
  });
  s.fresh = new Set(plus);
  s.gone = minus;
  const label = why || s.delta?.why || "";
  s.delta = plus.length || minus.length ? { plus, minus, why: label } : null;
}

// --- PROFIL ---------------------------------------------------------------------------------------

function renderProfile() {
  const s = S;
  if (!s) return;
  const sec = s.fProfile;
  sec.replaceChildren();
  fieldHead(sec, "Profil", "Wie der Agent läuft.");
  const body = el("div", "fdbody");
  const row = el("div", "fdprof");
  const h = chosenHarness();
  if (h) {
    row.append(profField("harness", "Agent", h.id, false, agentHarnesses().length < 2,
      agentHarnesses().length < 2 ? "Auf diesem Rechner ist nur dieser Agent eingerichtet." : "Welcher Agent in dieser Session läuft."));
    if (h.supports.model)
      row.append(profField("model", "Modell", s.model ? modelLabel(s.model) : modelShown(h), !s.model, false,
        s.model ? `Modell ${s.model}${filled("model") ? " — der MAIN-Standard aus dem Modellregister" : ""}` : "Ohne Angabe startet der Adapter sein eigenes."));
    if (h.supports.effort && h.effortLevels.length)
      row.append(profField("effort", "Effort", s.effort || "Adapter wählt", !s.effort, false,
        filled("effort") ? "Der MAIN-Standard aus dem Modellregister — ein Klick ändert ihn." : "Wie gründlich der Agent denkt — ohne Angabe wählt der Adapter."));
    if (h.supports.container && s.role === "main")
      row.append(profField("container", "Container", "ohne", true, true,
        "Eine MAIN läuft ohne Container — bootstrap-main nimmt keinen."));
    else if (h.supports.container)
      row.append(profField("container", "Container", s.container || containerDefaults?.container || "Fleet-Standard", !s.container, false,
        "Container und Docker-Daemon dieser Session — leer heißt der Fleet-Standard."));
  } else row.append(el("div", "fdnote", "Agenten werden gelesen …"));
  // WHAT SHE MAY DO AND READ (G6.6, E35): execution, her own work and the project views, per role —
  // the start grants no project view (foundingBody carries no grant field); assigning one is its
  // own step after the start, in the receipt or later in the session's Info (src/rights.ts)
  const prog = s.role === "main" ? s.progs?.find((x) => x.id === s.program)?.title ?? null : null;
  body.append(row, foundingRights(s.role, prog));
  sec.append(body);
}

function profField(which: Pop, label: string, value: string, dim: boolean, fixed: boolean, tip: string): HTMLElement {
  const s = S!;
  const wrap = el("div", "fdpfw");
  const b = btn(`fdpf${dim ? " dim" : ""}${s.pop === which ? " open" : ""}`);
  b.dataset.pop = which;
  b.setAttribute("aria-expanded", String(s.pop === which));
  b.disabled = fixed;
  b.title = tip;
  const v = el("span", "fdpfv");
  v.append(el("span", "", value));
  if (!fixed) v.append(icon("chevron"));
  b.append(el("span", "fdpfl", label), v);
  b.onclick = () => togglePop(which);
  wrap.append(b);
  if (s.pop === which) wrap.append(popBody(which));
  return wrap;
}

function popRow(label: string, sub: string, on: boolean, pick: () => void): HTMLButtonElement {
  const r = btn(`fdprow${on ? " on" : ""}`);
  r.append(el("span", "fdprn", label));
  if (sub) r.append(el("span", "fdmeta", sub));
  r.onclick = () => { pick(); closePop(true); renderAll(); };
  return r;
}

function popBody(which: Pop): HTMLElement {
  const s = S!;
  const pop = el("div", "fdpop");
  const h = chosenHarness();
  if (which === "harness") {
    for (const a of agentHarnesses()) {
      const on = (s.harness ?? agentHarnesses().find((x) => x.default)?.id) === a.id;
      const facts = [a.allowsLanes === false ? "keine Lanes" : "", a.supports.container ? "im Container" : ""].filter(Boolean).join(" · ");
      pop.append(popRow(a.id, facts, on, () => {
        // a model the role filled belongs to the role's agent, and never rides to another one
        const pf = s.profileFill;
        if (pf && filled("model") && (a.default ? null : a.id) !== pf.harness) s.model = "";
        s.harness = a.default ? null : a.id;
        // a value of the harness being left behind must not ride along
        if (!a.supports.effort || !a.effortLevels.includes(s.effort)) s.effort = "";
        if (!a.supports.model) s.model = "";
        if (!a.supports.container) { s.container = ""; s.containerContext = ""; }
      }));
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
    inp.onchange = () => { s.model = inp.value.trim(); closePop(true); renderAll(); };
    w.append(inp);
    pop.append(w);
  } else if (which === "effort" && h) {
    pop.append(popRow("Adapter wählt", "ohne Angabe", s.effort === "", () => { s.effort = ""; }));
    for (const lv of h.effortLevels) pop.append(popRow(lv, "", s.effort === lv, () => { s.effort = lv; }));
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

// the model a founding without a model value gets: the catalogue names it for the default adapter
// only (server.ts DEFAULT_MODEL); elsewhere the adapter decides, and the field says who
function modelShown(h: HarnessInfo): string {
  if (h.default && defaultModel) return modelLabel(defaultModel);
  return "Adapter wählt";
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
  if (refocus) s.shell.root.querySelector<HTMLElement>(`[data-pop="${which}"]`)?.focus();
}

// --- KONTEXT --------------------------------------------------------------------------------------

// the plan hangs off (place, harness, mode); a change of any of the three reads it again
function planKey(): string {
  const s = S!;
  return `${s.place ?? ""}|${s.harness ?? harnesses.find((h) => h.default)?.id ?? ""}|${s.mode === "repo" ? "main" : "lane"}`;
}

async function loadPlan() {
  const s = S;
  if (!s?.place) return;
  const seq = ++s.planSeq;
  const path = s.place;
  const key = planKey();
  s.planFor = key;
  s.plan = null;
  s.planErr = null;
  const harness = s.harness ?? harnesses.find((h) => h.default)?.id ?? "";
  const mode = s.mode === "repo" ? "main" : "lane";
  try {
    const res = await api(`/api/founding-plan?repo=${encodeURIComponent(path)}&harness=${encodeURIComponent(harness)}&mode=${mode}`);
    if (S !== s || seq !== s.planSeq || s.place !== path || key !== planKey()) return; // latest-wins
    if (res.status === 404) { s.planErr = SKEW_NOTE; return; }
    const j: unknown = await res.json().catch(() => null);
    if (S !== s || seq !== s.planSeq || s.place !== path || key !== planKey()) return;
    if (!res.ok || !validPlan(j)) s.planErr = `Der Plan für diesen Start ist nicht lesbar (Antwort ${res.status}).`;
    else s.plan = j;
  } catch {
    if (S !== s || seq !== s.planSeq || key !== planKey()) return;
    s.planErr = "Der Plan für diesen Start konnte nicht geladen werden.";
  } finally {
    if (S === s && seq === s.planSeq) {
      // a plan that cannot be read switches everything off: the start then carries no packs
      if (s.planErr) { s.packs = new Set(); s.presetDue = true; }
      else if (s.plan) {
        // AN AGENT CHANGE RE-PLANS, and says so: what arrives and what leaves is named in the delta,
        // what leaves for a reason of the plan is named with that reason (s.dropped) — never a swap
        const now = s.plan.harness ?? null;
        const moved = s.planHarness !== null && now !== null && now !== s.planHarness;
        s.planHarness = now;
        applyPreset(moved ? `Agent → ${now}` : "");
      }
      renderRole(); renderContext(); renderFoot();
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
function validPlan(j: unknown): j is Plan {
  if (!j || typeof j !== "object" || !("selected" in j) || !("omitted" in j)) return false;
  return Array.isArray(j.selected) && Array.isArray(j.omitted)
    && optional(j, "head", (v) => typeof v === "string") && optional(j, "plannedAt", (v) => typeof v === "number" && Number.isFinite(v))
    && j.selected.every((p: unknown) => !!p && typeof p === "object"
      && "id" in p && typeof p.id === "string" && "bytes" in p && typeof p.bytes === "number"
      && Number.isFinite(p.bytes) && p.bytes >= 0 && "source" in p
      && (p.source === "fleet-seed" || p.source === "repo-manifest")
      && (!("useWhen" in p) || p.useWhen === undefined || typeof p.useWhen === "string")
      && optional(p, "harnesses", strs) && optional(p, "triggers", strs) && optional(p, "anchors", validAnchors)
      && optional(p, "sourceHash", (v) => typeof v === "string"))
    && j.omitted.every((p: unknown) => !!p && typeof p === "object"
      && "id" in p && typeof p.id === "string" && "reason" in p && typeof p.reason === "string"
      && optional(p, "harnesses", strs));
}

function renderContext() {
  const s = S;
  if (!s) return;
  const sec = s.fContext;
  sec.replaceChildren();
  fieldHead(sec, "Kontext", "Was der Agent beim Start mitbekommt.");
  const body = el("div", "fdbody");
  sec.append(body);
  if (s.role === "main") {
    const line = el("div", "fdctx");
    const card = el("span", "fdcx fix srv", "Gründungsbrief des Programs");
    card.title = "bootstrap-main baut den Brief aus dem Program und hängt die Kontext-Anker an — der Startbeleg zeigt sie.";
    line.append(card);
    body.append(line, el("div", "fdnote", "Packs gehen hier nicht mit: die Gründungstür einer MAIN nimmt keine."));
    // the door decides; the window only says ahead what dirinfo already read
    if (s.info && !s.info.git) body.append(el("div", "fdnote warn", "Kein Git-Repo — bootstrap-main wird diesen Ordner voraussichtlich ablehnen."));
    return;
  }
  if (!s.info?.git) {
    body.append(el("div", "fdnote", s.info ? "Kein Git-Repo — hier gibt es keine Packs." : "Wird gelesen, sobald der Ort feststeht."));
    return;
  }
  if (s.planFor !== planKey()) void loadPlan();
  const line = el("div", "fdctx");
  if (s.role === "orch") {
    const card = el("span", "fdcx fix srv", "Rollenkarte");
    card.title = "Der Server stellt der Orchestratorin beim Start ihre Karte mit Kontext-Ankern zu.";
    line.append(card);
  }
  if (s.planErr) { body.append(line, el("div", "fdnote warn", `${s.planErr} Der Start geht dann ohne Packs.`)); return; }
  if (!s.plan || s.planFor !== planKey()) { line.append(el("span", "fdnote", "Plan wird gelesen …")); body.append(line); return; }
  const plan = s.plan;
  if (s.mode === "old") {
    body.append(line, el("div", "fdnote", "Ein fortgesetzter Worktree bekommt keine Packs — sie gehen nur bei einer frischen Gründung mit."));
    return;
  }
  const byId = new Map(plan.selected.map((p) => [p.id, p]));
  for (const id of [...s.packs]) {
    const p = byId.get(id);
    if (!p) continue;
    const mine = s.touched.has(id);
    const chip = el("span", `fdcx${s.fresh.has(id) ? " in" : ""}${mine ? " mine" : ""}`);
    chip.title = `${p.useWhen ?? "Zweck im Plan nicht angegeben."}\n${originSay(p)} · ${fassungSay(id)}${mine ? " · von dir dazugenommen" : ""}`;
    chip.append(el("span", "fdcxid mono", id));
    const rm = btn("fdcxrm");
    rm.append(icon("x"));
    rm.setAttribute("aria-label", `${id} weglassen`);
    rm.onclick = () => togglePack(id, false);
    chip.append(rm);
    line.append(chip);
  }
  for (const id of s.gone) line.append(el("span", "fdcx out mono", id));
  // ONE LINE, however many packs: what does not fit folds into "+N", which opens the list
  const more = btn("fdmore mono");
  more.hidden = true;
  more.title = "Alle Packs dieses Starts zeigen";
  more.onclick = () => { s.listOpen = true; renderContext(); };
  if (!s.listOpen) line.append(more);
  const rest = plan.selected.length - s.packs.size;
  const add = btn(`fdadd${s.pop === "add" ? " open" : ""}`);
  add.dataset.pop = "add";
  add.setAttribute("aria-expanded", String(s.pop === "add"));
  add.append(icon("plus"), el("span", "", "Pack"));
  if (rest) add.append(el("span", "fdaddn", String(rest)));
  add.title = rest ? `${rest} weitere passen zu diesem Start` : "Alle passenden Packs sind schon dabei.";
  add.onclick = () => togglePop("add");
  line.append(add);
  if (!plan.selected.length && !s.packs.size) line.append(el("span", "fdnote", "Dieses Repo erklärt keine Packs, die hier passen."));
  body.append(line);
  for (const d of s.dropped) body.append(el("div", "fdnote warn", `${d.id} fällt mit diesem Plan weg: ${d.why}.`));
  if (s.listOpen) line.classList.add("all"); else fitLine(line);
  if (s.pop === "add") body.append(addPop(plan));

  const foot = el("div", "fdctxfoot");
  const d = el("div", "fddelta mono");
  if (s.delta) {
    // a few names are said by name; more than three by their number, the names in the tooltip
    if (s.delta.why) d.append(el("span", "", `${s.delta.why}: `));
    const said = (xs: string[], sign: string, cls: string) => {
      if (xs.length > 3) { const n = el("span", cls, `${sign}${xs.length} Packs `); n.title = xs.join(", "); d.append(n); }
      else for (const x of xs) d.append(el("span", cls, `${sign}${x} `));
    };
    said(s.delta.plus, "+", "add");
    said(s.delta.minus, "−", "del");
  }
  const list = btn("fdghost", s.listOpen ? "Liste schließen" : "Alle Packs");
  list.setAttribute("aria-expanded", String(s.listOpen));
  list.onclick = () => { s.listOpen = !s.listOpen; renderContext(); };
  const cmp = btn("fdghost", s.compare ? "Vergleich schließen" : "Rollen vergleichen");
  cmp.setAttribute("aria-expanded", String(s.compare));
  cmp.onclick = () => { s.compare = !s.compare; renderContext(); };
  foot.append(d, list, cmp);
  body.append(foot);
  if (s.listOpen) body.append(packList(plan));
  if (s.compare) body.append(compareTable(plan));
  // light and strike are one paint long
  if (s.fresh.size || s.gone.length) {
    const fresh = s.fresh, gone = s.gone;
    setTimeout(() => {
      if (S !== s || s.fresh !== fresh || s.gone !== gone) return;
      s.fresh = new Set();
      s.gone = [];
      renderContext();
    }, 1400);
  }
}

// hide chips from the end until the line fits; the "+N" counts what it took in
function fitLine(line: HTMLElement) {
  const more = line.querySelector<HTMLElement>(".fdmore");
  if (!more) return;
  const chips = [...line.querySelectorAll<HTMLElement>(".fdcx:not(.fix)")];
  for (const c of chips) c.hidden = false;
  more.hidden = true;
  if (line.scrollWidth <= line.clientWidth) return;
  more.hidden = false;
  let folded = 0;
  for (let i = chips.length - 1; i >= 0 && line.scrollWidth > line.clientWidth; i--) {
    chips[i]!.hidden = true;
    folded++;
    more.textContent = `+${folded}`;
  }
  more.setAttribute("aria-label", `${folded} weitere Packs zeigen`);
}

// WHAT A PACK IS, in the words the list and the receipt share. Each sentence says only what its field
// carries: a fassung only where the id declares one (src/protocol.ts#packIdFassung), the ALLOWED agents
// apart from the model — no pack names one, so none is matched to the agent's model — and the delivery
// moment, which for every founding pack is the start (a verification trigger is a hint delivered at the
// start, not a later hook).
const isPrivate = (a: PackAnchors | undefined): a is { privateSourceId: string } => !!a && !Array.isArray(a);
const fassungSay = (id: string): string => {
  const n = packIdFassung(id);
  return n === null ? "keine Fassung deklariert" : `Fassung v${n} · laut Paket-ID`;
};
const originSay = (p: FoundingPlanPack): string =>
  isPrivate(p.anchors) ? "privat · aus der Fleet" : p.source === "fleet-seed" ? "aus der Fleet" : "aus dem Repo";
const whenSay = (triggers: readonly string[] | undefined): string =>
  !triggers ? "Zeitpunkt nicht gemeldet" : triggers.includes("verification") ? "beim Start · als Verify-Hinweis" : "beim Start";
const short = (sha: string | undefined | null, n: number): string => sha ? sha.slice(0, n) : "nicht gemeldet";

// one pack's facts line, and its sources on demand: anchors, the source hash the plan observed and the
// HEAD it observed it at — a private pack shows its opaque id and its declared hash, never a path or a
// byte of it, and says its verdict is taken at delivery
function packFacts(p: FoundingPlanPack, plan: Plan, open: boolean): HTMLElement[] {
  const facts = [fassungSay(p.id),
    p.harnesses ? `Agenten: ${p.harnesses.join(", ")}` : "Agenten: nicht gemeldet",
    "Modell: nicht gebunden", whenSay(p.triggers)];
  const out = [el("div", "fdluse", facts.join(" · "))];
  if (!open) return out;
  const src = el("div", "fdluse");
  if (p.triggers) src.append(el("div", "", `Trigger: ${p.triggers.join(", ")}`));
  if (isPrivate(p.anchors)) {
    src.append(el("div", "mono", `${p.anchors.privateSourceId} · privat, Inhalt wird nie gezeigt`),
      el("div", "mono", `Hash ${short(p.sourceHash, 12)} deklariert · Urteil erst bei der Zustellung`));
  } else {
    if (Array.isArray(p.anchors)) for (const a of p.anchors) src.append(el("div", "mono", `${a.path} | ${a.anchor}`));
    if (!p.anchors) src.append(el("div", "", "Quellen: nicht gemeldet"));
    src.append(el("div", "mono", `Quellstand ${short(p.sourceHash, 12)} · an HEAD ${short(plan.head, 8)}`));
  }
  out.push(src);
  return out;
}

// THE LIST — every pack of this start as one row with its switch, its purpose, where it comes from and
// what it is; its sources unfold per row. On demand only, the line above stays the resting state
function packList(plan: Plan): HTMLElement {
  const s = S!;
  const box = el("div", "fdlist");
  // the PREVIEW's state, said once above the rows: the commit the plan read and when
  const at = plan.plannedAt ? new Date(plan.plannedAt).toLocaleTimeString("de-DE") : null;
  box.append(el("div", "fdlrow fdluse", `Plan-Stand: HEAD ${short(plan.head, 8)}${plan.branch ? ` · ${plan.branch}` : ""}`
    + `${plan.harness ? ` · für ${plan.harness}` : ""} · ${at ? `gelesen ${at}` : "Zeitpunkt nicht gemeldet"}`));
  for (const p of plan.selected) {
    const on = s.packs.has(p.id);
    const row = el("div", `fdlrow${on ? " on" : ""}`);
    const sw = btn(`fdsw${on ? " on" : ""}`);
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-checked", String(on));
    sw.setAttribute("aria-label", `${p.id} mitgeben`);
    sw.dataset.pack = p.id;
    // the list repaints on every switch; the switch that was pressed keeps the focus
    sw.onclick = () => {
      togglePack(p.id, !on);
      S?.fContext.querySelector<HTMLElement>(`.fdsw[data-pack="${CSS.escape(p.id)}"]`)?.focus();
    };
    const t = el("div", "fdlt");
    const head = el("div", "fdlh");
    head.append(el("span", "mono", p.id), el("span", "fdlsrc", originSay(p)));
    if (s.touched.has(p.id)) head.append(el("span", "fdlmine", on ? "von dir dazu" : "von dir weggelassen"));
    else if (presetHas(presets[s.role], p.id)) head.append(el("span", "fdlrole", ROLES.find((r) => r.id === s.role)!.name));
    const shown = s.srcOpen.has(p.id);
    // the sources fold like the list itself; the button keeps the focus across the repaint
    const more = btn("fdghost", shown ? "Quellen schließen" : "Quellen");
    more.setAttribute("aria-expanded", String(shown));
    more.setAttribute("aria-label", `Quellen von ${p.id} ${shown ? "schließen" : "zeigen"}`);
    more.dataset.src = p.id;
    more.style.alignSelf = "flex-start";
    more.onclick = () => {
      if (shown) s.srcOpen.delete(p.id); else s.srcOpen.add(p.id);
      renderContext();
      S?.fContext.querySelector<HTMLElement>(`[data-src="${CSS.escape(p.id)}"]`)?.focus();
    };
    t.append(head, el("div", "fdluse", p.useWhen ?? "Zweck im Plan nicht angegeben."), ...packFacts(p, plan, shown), more);
    row.append(sw, t);
    box.append(row);
  }
  for (const o of plan.omitted) {
    const row = el("div", "fdlrow off");
    row.title = `intern: ${o.reason}`;
    const t = el("div", "fdlt");
    const head = el("div", "fdlh");
    head.append(el("span", "mono", o.id));
    t.append(head, el("div", "fdluse", `Nicht dabei: ${OMIT_SAY[o.reason] ?? o.reason}${o.harnesses?.length ? ` (nur ${o.harnesses.join(", ")})` : ""}`));
    row.append(el("span", "fdsw off"), t);
    box.append(row);
  }
  return box;
}

function addPop(plan: Plan): HTMLElement {
  const s = S!;
  const pop = el("div", "fdpop fdaddpop");
  const off = plan.selected.filter((p) => !s.packs.has(p.id));
  for (const p of off) {
    const r = btn("fdprow");
    r.append(el("span", "fdprn mono", p.id), el("span", "fdmeta", p.useWhen ?? ""));
    r.title = `${p.useWhen ?? ""}\n${p.source === "fleet-seed" ? "aus der Fleet" : "aus dem Repo"}`;
    r.onclick = () => { togglePack(p.id, true); if (S) { S.pop = plan.selected.length - S.packs.size ? "add" : null; renderContext(); focusPop(); } };
    pop.append(r);
  }
  if (!off.length) pop.append(el("div", "fdnote", "Alle passenden Packs sind dabei."));
  if (plan.omitted.length) {
    pop.append(el("div", "fdpopsep", "Passen nicht zu diesem Start"));
    for (const o of plan.omitted) {
      const row = el("div", "fdprow off");
      row.title = `intern: ${o.reason}`;
      row.append(el("span", "fdprn mono", o.id), el("span", "fdmeta", OMIT_SAY[o.reason] ?? o.reason));
      pop.append(row);
    }
  }
  return pop;
}

function togglePack(id: string, on: boolean) {
  const s = S;
  if (!s) return;
  const preset = presetHas(presets[s.role], id);
  if (on === preset) s.touched.delete(id); else s.touched.set(id, on);
  const before = new Set(s.packs);
  if (on) s.packs.add(id); else s.packs.delete(id);
  s.fresh = on && !before.has(id) ? new Set([id]) : new Set();
  s.gone = !on && before.has(id) ? [id] : [];
  s.delta = { plus: on ? [id] : [], minus: on ? [] : [id], why: on ? "von dir dazu" : "von dir weggelassen" };
  s.error = null;
  renderRole();
  renderContext();
  renderFoot();
}

// THE ROLES SIDE BY SIDE, over the packs of THIS start: a dot is a role's preset, a click redraws
// it. The column of the chosen role re-applies at once, so the switches above follow the table.
function compareTable(plan: Plan): HTMLElement {
  const s = S!;
  const box = el("div", "fdcmp");
  const t = el("table", "");
  const head = el("tr", "");
  head.append(el("th", "", "Pack"));
  for (const r of ROLES) head.append(el("th", r.id === s.role ? "cur" : "", r.name));
  t.append(head);
  for (const p of plan.selected) {
    const tr = el("tr", "");
    const name = el("td", "mono", p.id);
    name.title = p.useWhen ?? "";
    tr.append(name);
    for (const r of ROLES) {
      const td = el("td", r.id === s.role ? "cur" : "");
      if (r.id === "orch") { td.append(el("span", "fdcmpx", "—")); td.title = "Die Rollenkarte trägt ihre Zeiger."; tr.append(td); continue; }
      if (r.id === "main") { td.append(el("span", "fdcmpx", "—")); td.title = "bootstrap-main nimmt keine Packs."; tr.append(td); continue; }
      const on = presetHas(presets[r.id], p.id);
      const pip = btn(`fdpip${on ? " on" : ""}`);
      pip.setAttribute("role", "switch");
      pip.setAttribute("aria-checked", String(on));
      pip.setAttribute("aria-label", `${p.id} für ${r.name}`);
      pip.onclick = () => { redrawPreset(r.id, p.id, !on); };
      td.append(pip);
      tr.append(td);
    }
    t.append(tr);
  }
  const why = el("tr", "fdcmpwhy");
  why.append(el("td", "", "Wozu"));
  for (const r of ROLES) why.append(el("td", r.id === s.role ? "cur" : "", r.why));
  t.append(why);
  const foot = el("div", "fdcmpfoot");
  const said = s.presetNote ?? (s.presetState === "saving" ? "Wird gesichert …"
    : s.presetState === "saved" ? "Gesichert — gilt für alle künftigen Starts."
    : "Ein Punkt ist die Vorauswahl einer Rolle — ein Klick ändert sie, für alle künftigen Starts.");
  foot.append(el("span", s.presetNote ? "warn" : "", said));
  if (ROLES.some((r) => customized(r.id))) {
    const reset = btn("fdghost", "Auf Standard zurücksetzen");
    reset.title = "Jede Rolle wieder auf ihre eingebaute Vorauswahl.";
    reset.onclick = resetPresets;
    foot.append(reset);
  }
  box.append(t, foot);
  return box;
}

function redrawPreset(r: Role, id: string, on: boolean) {
  const s = S;
  if (!s) return;
  const p = presets[r];
  const list = p.base === "all" ? p.minus : p.plus;
  const want = p.base === "all" ? !on : on;
  const next = want ? [...new Set([...list, id])] : list.filter((x) => x !== id);
  presets = { ...presets, [r]: p.base === "all" ? { ...p, minus: next } : { ...p, plus: next } };
  if (r === s.role) { s.touched.delete(id); applyPreset(`Vorauswahl ${ROLES.find((x) => x.id === r)!.name}`); }
  renderRole();
  renderContext();
  renderFoot();
  void savePresets();
}

// THE STORE. Read once per window; a role the store does not name keeps its built-in preset. A
// store that cannot be read is SAID next to the table — the built-in presets then apply, which is
// never the same claim as "you changed nothing".
async function loadPresets() {
  const s = S;
  if (!s) return;
  try {
    const res = await api("/api/role-presets");
    if (S !== s) return;
    if (res.status === 404) { s.presetNote = SKEW_NOTE; return; }
    const j = (await res.json().catch(() => null)) as { presets?: unknown } | null;
    if (S !== s) return;
    const stored = res.ok && j ? (j.presets === null ? {} : normalizeRolePresets(j.presets)) : null;
    if (!stored) { s.presetNote = `Die gesicherte Vorauswahl ist nicht lesbar (Antwort ${res.status}) — es gilt die eingebaute.`; return; }
    const mine: Partial<Record<Role, Preset>> = {};
    presetsForeign = {};
    for (const [r, v] of Object.entries(stored)) if (v) { if (isWindowRole(r)) mine[r] = v; else presetsForeign[r] = v; }
    presets = { ...clonePresets(PRESET_DEFAULT), ...mine };
    applyPreset("");
  } catch {
    if (S === s) s.presetNote = "Die gesicherte Vorauswahl konnte nicht geladen werden — es gilt die eingebaute.";
  } finally {
    if (S === s) { renderRole(); renderContext(); renderFoot(); }
  }
}

// only the roles the owner changed are stored, so a later change of a built-in preset still
// reaches every role nobody redrew; none changed is the reset
async function savePresets() {
  const s = S;
  if (!s) return;
  const changed = { ...presetsForeign, ...Object.fromEntries(ROLES.filter((r) => customized(r.id)).map((r) => [r.id, presets[r.id]])) };
  s.presetState = "saving";
  renderContext();
  const res = await post("/api/role-presets", { presets: Object.keys(changed).length ? changed : null }).catch(() => null);
  if (S !== s) return;
  if (res?.ok) { s.presetState = "saved"; s.presetNote = null; }
  else {
    const j = res ? (await res.json().catch(() => null)) as { error?: string } | null : null;
    s.presetState = "error";
    s.presetNote = `Nicht gesichert: ${j?.error ?? (res ? `Antwort ${res.status}` : "der Server ist nicht erreichbar")}. Für dieses Fenster gilt die Änderung trotzdem.`;
  }
  renderContext();
}

function resetPresets() {
  const s = S;
  if (!s) return;
  presets = clonePresets(PRESET_DEFAULT);
  s.touched.clear();
  applyPreset("Vorauswahl zurückgesetzt");
  renderRole();
  renderContext();
  renderFoot();
  void savePresets();
}

// --- the foot: one sentence, and the one button ---------------------------------------------------

function renderFoot() {
  const s = S;
  if (!s) return;
  if (s.proof) { renderProof(); return; }
  const foot = s.shell.foot;
  // the button is rebuilt on every paint; if it held the focus, the new one takes it over
  const hadGo = document.activeElement instanceof HTMLElement && document.activeElement.classList.contains("fdgo") && foot.contains(document.activeElement);
  foot.replaceChildren();
  const say = el("div", "fdsay");
  const who = { leer: "Eine Session ohne Rolle", lane: "Eine Lane", orch: "Eine Orchestratorin", main: "Eine MAIN" }[s.role];
  const repo = s.place ? baseName(s.place) : "…";
  const prog = s.role === "main" ? s.progs?.find((x) => x.id === s.program) : undefined;
  const where = s.role === "main" ? `${prog ? `für „${prog.title}“ ` : ""}in ${repo}`
    : s.mode === "new" ? `in einem neuen Worktree${branchFor(s.name) ? ` „${s.name.trim()}“` : ""} von ${repo}`
    : s.mode === "old" ? `in ${s.orphan ? baseName(s.orphan) : "einem liegengebliebenen Worktree"}` : `in ${repo}`;
  const h = chosenHarness();
  const body = foundingBody();
  const prof = [body.harness ?? h?.id ?? "", body.model ? modelLabel(body.model) : h ? modelShown(h) : "", body.effort ?? ""].filter(Boolean).join(" · ");
  const ctx = s.role === "main" ? "Gründungsbrief" : s.packs.size ? `${s.packs.size} ${s.packs.size === 1 ? "Pack" : "Packs"}` : "ohne Packs";
  say.append(el("b", "", who), document.createTextNode(` ${where}`), el("span", "fdsaym", ` · ${prof} · ${ctx}${s.role === "orch" ? " · Rollenkarte" : ""} · ohne Projektsicht`));
  // a plan nobody could read starts without packs — allowed, but never silently
  const planGone = !!s.planErr && s.mode !== "old" && !!s.info?.git && s.role !== "main";
  // bootstrap-main picks the free MAIN place itself — the clicked one is a likely answer, not a promise
  const seat = s.role === "main" && s.entry.kind === "slot" ? `Den Platz wählt der Server — nicht unbedingt Slot ${s.entry.slot}.` : null;
  const why = s.error ?? blocker() ?? (planGone ? "Der Plan für diesen Start ist nicht lesbar — er startet ohne Packs." : seat);
  const note = el("div", `fdfootnote${s.error || planGone ? " warn" : ""}`, why ?? "");
  const go = btn("fdgo");
  const label = s.busy ? (s.role === "main" ? "MAIN wird gegründet …" : s.packs.size ? "Packs werden zugestellt …" : "Startet …")
    : s.role === "main" ? "MAIN gründen" : s.mode === "old" ? "Fortsetzen" : s.mode === "new" ? "Lane starten" : "Starten";
  go.append(el("span", "", label));
  if (!s.busy) go.append(el("kbd", "", "⏎"));
  go.disabled = s.busy || blocker() !== null;
  go.title = s.place ? `${label}: ${tilde(s.place)} (Enter)` : label;
  go.onclick = () => { void start(); };
  const text = el("div", "fdsaycol");
  text.append(say);
  if (why) text.append(note);
  foot.append(text, go);
  if (hadGo) go.focus({ preventScroll: true });
}

// --- starting ----------------------------------------------------------------------------------------

async function start() {
  const s = S;
  if (!s || s.busy || s.proof || blocker() !== null || !s.place) return;
  s.error = null;
  const onError = (msg: string) => { if (S === s) { s.error = msg; renderFoot(); } };
  // The door answers after delivery; keep its refusal beside the resulting occupant.
  s.busy = true;
  renderFoot();
  try {
    const body = foundingBody();
    const branch = s.mode === "new" ? branchFor(s.name) : "";
    // the start receipt (552958ea): what was asked, read back at the occupant the start produced
    const before = new Map(fleet.map((row) => [row.id, row.openedAt]));
    const requestedRole = s.role, requestedMode = s.mode;
    const requestedPlace = s.mode === "old" ? s.orphan! : s.place;
    // THE PREVIEW the owner saw for the chosen packs: the receipt is held against it after the start
    const plan = s.plan && s.planFor === planKey() ? s.plan : null;
    const preview: StartPreview | null = plan && body.packs?.length
      ? { head: plan.head ?? null, plannedAt: plan.plannedAt ?? null, packs: plan.selected.filter((p) => body.packs!.includes(p.id)) }
      : null;
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
    } else if (s.entry.kind === "lane") {
      // ⎇+: the server picks the next free place and hangs the lane under the session it came from
      const res = await post("/api/lanes", { repo: s.place, ...(s.entry.parent ? { parent: s.entry.parent } : {}), branch, ...body });
      const j = (await res.json().catch(() => ({}))) as { slot?: number; error?: string; packsDelivered?: boolean; reason?: string };
      if (!res.ok) { onError(j.error ?? `Der Server antwortete ${res.status}.`); return; }
      // the lane stands; the delivery refusal stays visible in its start receipt
      if (j.packsDelivered === false) onError(j.reason ?? "Die Lane steht, aber die Packs kamen nicht an.");
      if (!j.slot || !await revealStartedSlot(j.slot)) { onError(`Die Lane steht, aber ihr Slot erschien nicht binnen 5 Sekunden.`); return; }
      result = { ok: true, slot: j.slot, packsDelivered: j.packsDelivered, reason: j.reason };
    } else if (s.mode === "new") {
      result = await startWorktree(s.place, onError, { slot: s.entry.slot, body: { ...body, ...(branch ? { branch } : {}) } });
    } else if (s.mode === "old") {
      // the clicked place: the lane is seated exactly here, or refused naming who sits there. An
      // attach never carries packs — the door refuses a packs list for a worktree it did not found.
      const { packs: _packs, ...attach } = body;
      const res = await post("/api/lanes", { repo: s.place, attach: s.orphan, slot: s.entry.slot, ...attach });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        onError(err.error ?? `Der Server antwortete ${res.status}.`);
        return;
      }
      const j = (await res.json().catch(() => ({}))) as { slot?: number };
      const shown = j.slot ?? s.entry.slot;
      if (!await revealStartedSlot(shown)) { onError(`Die Lane sitzt, aber Slot ${shown} erschien nicht binnen 5 Sekunden.`); return; }
      result = { ok: true, slot: shown };
    } else {
      result = await startSession(s.place, roleLabel(s.role), onError, { slot: s.entry.slot, body });
    }
    if (result.ok && S === s) await captureProof(s, s.role === "main" ? mainSpawn() : body, before.get(result.slot), result, requestedRole, requestedMode, requestedPlace, bound, preview);
  } finally {
    // a start answers seconds later (packs: boot grace plus readiness); by then the owner may have
    // closed this window and opened the next — only the window that asked shows the receipt
    if (S === s) { s.busy = false; renderFoot(); }
  }
}

// THE MAIN'S DOOR. A refusal is shown as the server wrote it, status first and every further field
// of its answer verbatim (a 503 carries availability/recovery/affected beside the sentence), and
// existing:true is shown as what it is — the Program already has a living MAIN, nothing was founded.
async function foundMain(pid: string, onError: (msg: string) => void): Promise<{ slot: number; bound: number | null } | null> {
  let res: Response;
  try {
    res = await post(`/api/programs/${encodeURIComponent(pid)}/bootstrap-main`, mainBody());
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

interface ReceiptPack {
  id: string; useWhen?: string;
  anchors: { path: string; anchor: string }[] | { privateSourceId: string };
  sourceHash?: string; private?: { verdict: string; version: number | null };
}
interface StartPreview { head: string | null; plannedAt: number | null; packs: FoundingPlanPack[] }
interface StartProof {
  result: Extract<StartResult, { ok: true }>;
  body: SpawnBody; role: Role; mode: Mode; place: string;
  bound: number | null;                 // a MAIN: the slot the Program's binding names after the door
  preview: StartPreview | null;         // the plan's state of the chosen packs when the start was pressed
  occupant: SlotInfo | null;
  receipt: { slot: number; at: number; head?: string; selected: ReceiptPack[]; omitted?: { id: string; why?: string; reason?: string | null }[] } | null;
  receiptCount: number; receiptError: string | null; stale: boolean;
}

async function captureProof(s: State, body: SpawnBody, before: number | undefined, result: Extract<StartResult, { ok: true }>, role: Role, mode: Mode, place: string, bound: number | null, preview: StartPreview | null) {
  const row = fleet.find((r) => r.id === result.slot);
  const occupant = row?.cwd && Number.isFinite(row.openedAt) && row.openedAt! > 0 && row.openedAt !== before
    ? structuredClone(row) : null;
  const proof: StartProof = { result, body, role, mode, place, bound, preview, occupant,
    receipt: null, receiptCount: 0, receiptError: null, stale: false };
  s.proof = proof;
  closePop(false);
  s.shell.root.classList.add("fdproved");
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
  if (body.packs?.length || role === "orch" || role === "main") {
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
  // the head names the window's content, never a slot state: "Slot 2 · frei" stood beside
  // "geöffnet 01:00:02" (owner 02.10.) — the status line above is where the slot's state is said
  s.shell.setSubtitle(`Startbeleg · Slot ${p.result.slot}`);
  const table = el("div", "fdproof");
  table.setAttribute("role", "table");
  const header = el("div", "fdproofrow fdproofheadrow");
  header.append(el("span", ""), el("span", "fdproofhead", "angefragt"), el("span", "fdproofhead", "am Slot zurückgelesen"));
  table.append(header);
  // WITHOUT A NEW SESSION nothing was read back, and the status line says so once: the right column
  // is a muted "—", never six orange "nicht gemeldet · Beleg fehlt" (owner 02.10.). Orange stays
  // for a real gap — a session that started and did not report a field, or a value that differs.
  const field = (name: string, requested: string | undefined, observed: string | undefined, mono = false, compare = true, comparedValue = observed) => {
    const r = el("div", "fdproofrow"); r.dataset.field = name;
    if (!row && observed === undefined) {
      r.dataset.state = "unread";
      const none = el("div", "fdactual fdnone", "—");
      r.append(el("span", "fdproofkey", name), el("div", `fdrequested${mono ? " mono" : ""}`, requested ?? "ohne Angabe"), none);
      table.append(r);
      return none;
    }
    const missing = observed === undefined;
    const differs = compare && requested !== undefined && !missing && requested !== comparedValue;
    r.dataset.state = missing ? "missing" : differs ? "difference" : "same";
    const actual = el("div", `fdactual${missing || differs ? " warn" : ""}${mono ? " mono" : ""}`,
      observed ?? "nicht gemeldet");
    if (differs) actual.append(el("span", "fdproofnote", "Abweichung"));
    else if (missing) actual.append(el("span", "fdproofnote", "Beleg fehlt"));
    else if (requested === undefined && compare) actual.append(el("span", "fdproofnote", "Standard, nicht angefragt"));
    r.append(el("span", "fdproofkey", name), el("div", `fdrequested${mono ? " mono" : ""}`, requested ?? "ohne Angabe"), actual);
    table.append(r);
    return actual;
  };
  // the role in the founding window's own words (ROLES): Leer, Lane, Orchestratorin, MAIN — read
  // back from the slot by the same marks the server keys them off
  const roleName = (r: Role): string => ROLES.find((x) => x.id === r)!.name;
  const requestedRole = roleName(p.role);
  // a MAIN is read back at the Program's binding, not at a label: the door's answer names the slot it bound
  const observedRole = !row ? undefined : roleName(p.role === "main" && p.bound === p.result.slot ? "main"
    : row.worktree ? "lane" : /\borchestrator\b/i.test(row.label ?? "") ? "orch" : "leer");
  field("Rolle", requestedRole, observedRole);
  const place = field("Ort", p.place, row?.cwd ?? undefined, true, true, p.mode === "new" ? row?.worktree?.repo ?? row?.cwd ?? undefined : row?.cwd ?? undefined);
  if (row?.worktree) place.append(el("div", "mono", `Branch: ${row.worktree.branch ?? "nicht gemeldet"}`));
  field("Agent", p.body.harness, row ? row.harness ?? harnesses.find((h) => h.default)?.id : undefined, true);
  field("Modell", p.body.model, row?.model ?? undefined, true);
  field("Effort", p.body.effort, row?.effort, true);
  if (p.body.container || row?.container) field("Container", p.body.container, row?.container, true);
  if (p.body.containerContext || row?.containerContext) field("Docker-Daemon", p.body.containerContext, row?.containerContext, true);
  // without a new session nothing was read back, so "keine" would claim what nobody measured
  const needsReceipt = !!p.body.packs?.length || p.role === "orch" || p.role === "main";
  const packCell = field("Packs", p.body.packs?.join("\n") ?? (p.role === "main" ? "Gründungsbrief des Programs" : "keine"),
    p.result.packsDelivered === false ? `nicht zugestellt: ${p.result.reason ?? "Grund nicht gemeldet"}`
      : !row ? undefined : !needsReceipt ? "keine" : p.receipt ? p.receipt.selected.map((pack) => pack.id).join("\n") : undefined, true, false);
  if (p.result.packsDelivered === false) packCell.classList.add("warn");
  else if (p.receipt) {
    packCell.replaceChildren();
    // THE RECEIPT AGAINST THE PREVIEW (src/protocol.ts#standSincePreview): the receipt's hash and HEAD
    // are what the delivery stamped; where they moved since the plan, the delivered one is shown as
    // the fact and the preview's beside it. Where either side names nothing, the stand is unknown.
    const stand = p.body.packs ? standSincePreview(p.preview, p.receipt, p.body.packs) : null;
    const standOf = (id: string) => stand?.packs.find((r) => r.id === id);
    packCell.append(el("div", "fdproofnote", `zugestellt ${new Date(p.receipt.at).toLocaleTimeString("de-DE")} · ${headSay(stand, p.receipt.head)}`));
    for (const pack of p.receipt.selected) {
      const item = el("div", "fdreceiptpack");
      item.append(el("div", "mono", pack.id));
      if (pack.useWhen) item.append(el("div", "fdproofnote", pack.useWhen));
      const anchors = Array.isArray(pack.anchors) ? pack.anchors.map((a) => `${a.path} | ${a.anchor}`)
        : pack.anchors?.privateSourceId ? [pack.anchors.privateSourceId] : [];
      for (const anchor of anchors) item.append(el("div", "mono", anchor));
      item.append(el("div", "mono", pack.sourceHash ? `Hash: ${pack.sourceHash.slice(0, 12)}` : "Hash: nicht gemeldet"));
      if (!anchors.length || !pack.sourceHash) item.classList.add("warn");
      // the receipt names a fassung only where the id declares one; the private line's "Fassung" is
      // the konzept ledger's count, said in its existing words and never mixed with this one
      if (packIdFassung(pack.id) !== null) item.append(el("div", "fdproofnote", fassungSay(pack.id)));
      if (pack.private) item.append(el("div", "fdproofnote", `Urteil: ${pack.private.verdict} · Fassung: ${pack.private.version ?? "nicht gemeldet"}`));
      const r = standOf(pack.id);
      if (r) {
        const line = el("div", `fdproofnote${r.stand === "same" ? "" : " warn"}`, standSay(r.stand, r.preview, r.delivered));
        // only the stand line warns: the anchors and the hash above it are the delivered facts, not a gap
        item.append(line);
      }
      packCell.append(item);
    }
    // requested and not in the receipt: the receipt's own omission reason where it has one
    for (const r of stand?.packs.filter((x) => x.stand === "not-delivered") ?? []) {
      packCell.append(el("div", "warn", `nicht zugestellt: ${r.id}${r.why ? ` — ${r.why}` : " — der Beleg nennt keinen Grund"}`));
      packCell.classList.add("warn");
    }
    const extra = stand?.packs.filter((x) => x.stand === "extra") ?? [];
    if (extra.length) { packCell.append(el("div", "warn", `Abweichung: zusätzliche Packs ${extra.map((x) => x.id).join(", ")}`)); packCell.classList.add("warn"); }
    if (p.body.packs?.length) packCell.append(el("div", "fdproofnote", "Zugestellt heißt: der Zeiger stand im Brief. Ob er gelesen wurde, sagt kein Beleg."));
    if (p.receiptCount > 1) packCell.append(el("div", "fdproofnote", `${p.receiptCount} Startbelege — der jüngste gilt.`));
  }
  if (p.receiptError) packCell.append(el("div", "fdproofnote", p.receiptError));
  // E38/E39: THE PROJECT VIEWS this start granted — none, by construction — read back FRESH at the
  // occupant the start produced (GET …/memory-grant after the start, never before it). Below the
  // table the same block as in the session's Info, as an optional step of its own: a failure there
  // is said in the block, and the status line above stays what the start was.
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
      const h = el("div", "fdlab");
      h.append(el("span", "fdlabt", "Projektsichten"), el("span", "fdlabh", "optional — die Session läuft auch ohne"));
      step.append(h, gr.step);
    }
  }
  detail.append(table);
  if (step) detail.append(step);
  s.shell.foot.replaceChildren();
  // no session started: there is nothing to go to, so the button is not offered at all — and the
  // focus it held stays inside the window
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
  if (!row.worktree && !p.stale) {
    const t = el("div", "fdsaycol");
    t.append(el("div", "fdsay", "Die Session steht. Was du hier zuweist, ist ein eigener Schritt und ändert den Start nicht."));
    s.shell.foot.append(t);
  }
  s.shell.foot.append(go);
}
