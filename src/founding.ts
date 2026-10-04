// THE FOUNDING WINDOW — what a click on a free place in the bar opens, and what ⎇+ on a session
// opens. Since 2026-10-04 it is the PROFILE WINDOW of design v3 (docs/design/rollenkarten-notiz.md,
// Program fe44f11a, owner: „[Zitat entfernt]“): the place on top,
// then three numbered steps — ① Profil wählen (Lane, MAIN, Orchestratorin, Leer, each with the size
// of its file), ② Anpassen (Agent, Modell, Effort as switches, rights as a placeholder, the packs as
// ONE TREE Gruppe → Pack → Teil, never a card list) and ③ Was der Agent liest, the largest field: the
// session file the server renders (GET /api/founding-plan, sessionAgents) in its fixed order Rolle,
// Auftrag, Anleitung, Wissen, Packs auf Abruf, Schluss. Every switch on the left re-reads the file
// on the right; every byte shown is the route's or measured on the route's text, none is estimated.
//
// A DEVIATION FROM THE PROFILE CARRIES A DOT. A role is a profile: its agent, model and effort
// (ROLE_PROFILE), its pack preset and the parts' default place per position. What the owner changes
// here is a deviation for this session only, counted in the foot; „[Zitat entfernt]“ takes every one back
// and "Als Profil sichern" stores the pack choice over the existing preset door (/api/role-presets).
// Technical facts — ids, sources, hashes — show only on hover or keyboard focus of their row, and
// in the flow where there is no hover (grammatik.md §1 Mobil, G4.1, G6.1).
//
// MAIN REPLACES THE STEWARD CARD (owner 2026-10-02: „[Zitat entfernt]“). A MAIN is
// founded for exactly one ACTIVE Program over its existing owner door, POST
// /api/programs/:id/bootstrap-main — the same door the Program detail in src/queue.ts uses. The
// window reads GET /api/programs fresh, offers only a Program without a living MAIN, shows the
// others greyed with their reason, and says "unbekannt" where the row does not carry the fact.
// The door takes cwd (the Ort), harness, model and effort; no packs and no container — the
// server builds the Program's own founding brief and picks the free MAIN place itself.
//
// A LANE IS A WORKTREE. The Lane role and the "Neuer Worktree"/"Worktree fortsetzen" places are
// one choice seen from two fields: picking one moves the other, and the window says so.
//
// It is a src/shell.ts#openShell window without a list (the #shell-idee precedent): the shell
// brings the dimmed backdrop and Esc/✕/click-beside closing. Enter outside a control starts; the
// start button holds the focus when the window opens, so "open, Enter" is a plain founding.
//
// Doors, all existing: /api/dirs, /api/dirinfo, /api/founding-plan (packs= and parts= pick what the
// file renders), /api/role-presets, POST /api/slots/:id/open and /open-worktree for a clicked free
// place, POST /api/lanes for ⎇+ (with its parent) and for an attach.
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
  type FoundingPlanPart, type FoundingRole, type FoundingSessionAgents, type LaneAnchor, type PackAnchors, type PackStand,
  type RolePreset } from "./protocol";
import { openShell, type Shell } from "./shell";
import { dropGrantMount, foundingRights, proofGrantRow } from "./rights";

// the window's roles. "main" is no stored preset role: bootstrap-main carries no packs, so it has
// no preset to redraw, and the server's preset store (src/protocol.ts#FOUNDING_ROLES) never sees it
type Role = Exclude<FoundingRole, "steward"> | "main";
const isWindowRole = (r: string): r is Role => r === "leer" || r === "lane" || r === "orch" || r === "main";
type Mode = "repo" | "new" | "old";

// `say` is the card's sentence (G0.5, owner words), in the order of design v3
const ROLES: { id: Role; name: string; glyph: string; say: string }[] = [
  { id: "lane", name: "Lane", glyph: "⎇", say: "Arbeitet einen Auftrag im eigenen Worktree ab und beweist ihn." },
  { id: "main", name: "MAIN", glyph: "◆", say: "Führt ein Program: schneidet Karten, treibt Lanes, landet." },
  { id: "orch", name: "Orchestratorin", glyph: "◎", say: "Hält das Portfolio, schärft Aufträge, verteilt Arbeit." },
  { id: "leer", name: "Leer", glyph: "○", say: "Ohne Rolle. Agent und Modell wählst du frei." },
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
interface Plan {
  head?: string; branch?: string | null; harness?: string; plannedAt?: number; selected: FoundingPlanPack[]; omitted: FoundingPlanOmission[];
  // the session file the server renders for this plan (c2a97f12); absent on an older server
  sessionAgents?: FoundingSessionAgents;
}
interface DirList { path: string; parent: string | null; dirs: string[]; repos?: string[]; capped?: boolean; total?: number }
interface FindHit { path: string; name: string; repo: boolean }
// one Program as the MAIN choice reads it off GET /api/programs. `state` is the server's own
// health.occupancy (the same comparison bootstrap-main's live guard makes); a row whose founding
// marker stands, or that carries no readable occupancy, is "unknown" — never guessed free.
type ProgState = "free" | "stale" | "live" | "unknown";
interface ProgRow { id: string; title: string; state: ProgState; slot: number | null }
type Pop = "place" | "model" | "container";

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
  delta: { plus: string[]; minus: string[]; why: string } | null;
  dropped: { id: string; why: string }[]; // packs the last plan switched off, each with the plan's reason
  parts: Map<string, PartOrt>;          // the owner's part switches against the profile's default place
  open: Set<string>;                    // the tree's unfolded groups and packs
  // the file on screen and the query it answers; a newer query in flight is `filePending`
  file: FoundingSessionAgents | null; fileErr: string | null; fileFor: string | null; filePending: string | null; fileSeq: number;
  shown: Map<string, number> | null;    // the section sizes last painted, so a change lights up once
  flash: Set<string>;
  sizes: Partial<Record<Role, number | null>>; sizesFor: string | null; sizesSeq: number; // each profile's file alone
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
  // the place, the three steps and the foot, each repainted on its own: ② is settings + tree
  fPlace: HTMLElement; fRole: HTMLElement; fProfile: HTMLElement; fPacks: HTMLElement; fFile: HTMLElement;
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
  // the place, ① the profiles, then ② beside ③: the file is the widest field (design v3)
  const fPlace = el("section", "fdsec"), fRole = el("section", "fdstep fdstep1"),
    fProfile = el("div", "fdset"), fPacks = el("div", "fdpacks"), fFile = el("section", "fdstep fdfile");
  const left = el("section", "fdstep fdleft");
  left.append(stepHead(2, "Anpassen", "gilt nur für diese Session, das Profil bleibt"), fProfile, fPacks);
  const cols = el("div", "fdcols");
  cols.append(left, fFile);
  shell.detail.replaceChildren(fPlace, fRole, cols);
  // focusable without a tab stop: a click on empty space lands here, and Enter then starts
  shell.detail.tabIndex = -1;
  const repos = repoList();
  S = {
    shell, flakes, entry, role: laneEntry ? "lane" : "leer", mode: laneEntry ? "new" : "repo", name: "", note: null,
    repos, view: repos.length ? "repos" : "folders", place: null,
    info: null, infoErr: null, infoSeq: 0, plan: null, planErr: null, planFor: null, planSeq: 0, planHarness: null,
    packs: new Set(), touched: new Map(), presetDue: true, delta: null, dropped: [], presetState: "idle", presetNote: null,
    parts: new Map(), open: new Set(), file: null, fileErr: null, fileFor: null, filePending: null, fileSeq: 0, shown: null, flash: new Set(),
    sizes: {}, sizesFor: null, sizesSeq: 0,
    orphan: null, progs: null, progOther: 0, progErr: null, progSeq: 0, program: null, harness: null, model: "", effort: "", container: "", containerContext: "",
    profileFill: null, dir: "~", list: null, listErr: null, listSeq: 0, find: "", hits: null, findPartial: false, findSeq: 0,
    findTimer: null, paintFolders: null, error: null, busy: false, proof: null, pop: null, restore, teardown: () => {},
    fPlace, fRole, fProfile, fPacks, fFile,
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
    // a focusable row of the file shows its details on focus; its Enter is not the window's
    const inControl = !!t?.closest("button, input, select, textarea, [contenteditable], .fdrow[tabindex]");
    if (inControl && !(e.metaKey || e.ctrlKey)) return;
    e.preventDefault();
    e.stopPropagation();
    void start();
  };
  window.addEventListener("keydown", onKey, true);
  shell.root.addEventListener("pointerdown", onDown, true);
  // capture: the app's own keyboard (the composer, the panes) must not see an Enter this window took
  window.addEventListener("keydown", onWinKey, true);
  S.teardown = () => {
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("keydown", onWinKey, true);
  };
  if (entry.kind === "lane") choosePlace(entry.repo);
  else if (repos.length) choosePlace(repos[0]!.repo);
  else { renderAll(); void loadDir("~"); }
  void loadPresets();
  // fetch-once: the catalogue is needed exactly when a founding is being composed
  void loadHarnesses().then(() => { if (S) renderAll(); });
  if (!isMobile()) S.shell.foot.querySelector<HTMLElement>(".fdgo")?.focus({ preventScroll: true });
}

export function closeFounding() {
  S?.shell.close();
}

function renderAll() {
  // after a start the window shows its receipt; the steps are no longer on screen
  if (S?.proof) { renderProof(); return; }
  renderPlace();
  renderRole();
  renderProfile();
  renderPacks();
  renderFile();
  renderFoot();
}

function fieldHead(sec: HTMLElement, title: string, hint: string) {
  const h = el("div", "fdlab");
  h.append(el("span", "fdlabt", title), el("span", "fdlabh", hint));
  sec.append(h);
}

// a numbered step's head: the reading order 1 → 2 → 3 (design v3)
function stepHead(n: number, title: string, hint: string): HTMLElement {
  const h = el("div", "fdsteph");
  h.append(el("span", "fdstepn", String(n)), el("span", "fdstept", title), el("span", "fdsteph2", hint));
  return h;
}

// THE TECHNICAL LINE of a row: on hover or keyboard focus a card under the row that pushes nothing,
// in the flow where there is no hover (CSS: .fdhv). Ids, sources and short hashes live only here.
function hv(row: HTMLElement, ...lines: string[]): HTMLElement {
  row.classList.add("fdrow");
  const card = el("div", "fdhv");
  for (const line of lines.filter(Boolean)) card.append(el("div", "", line));
  row.append(card);
  return row;
}

// A REPAINT THAT ANSWERS LATE (the file, the plan, the sizes) keeps the keyboard where it was: the
// focused control is found again by its data key after the field is rebuilt
const FOCUS_KEYS = ["pack", "group", "part", "fold", "agent", "effort", "role", "sec"];
function keepFocus(paint: () => void) {
  const a = document.activeElement;
  const key = a instanceof HTMLElement && S?.shell.root.contains(a) ? FOCUS_KEYS.find((k) => a.dataset[k] !== undefined) : undefined;
  const value = key && a instanceof HTMLElement ? a.dataset[key] : undefined;
  paint();
  if (key && value !== undefined && !(document.activeElement instanceof HTMLElement && S?.shell.root.contains(document.activeElement) && document.activeElement !== document.body))
    S?.shell.root.querySelector<HTMLElement>(`[data-${key}="${CSS.escape(value)}"]`)?.focus({ preventScroll: true });
}

// sizes the way design v3 says them: one decimal in KB (1 KB = 1000 B), a comma, never an estimate
const kb = (bytes: number): string => `${(bytes / 1000).toFixed(1).replace(".", ",")} KB`;
const bytesOf = (text: string): number => new TextEncoder().encode(text).byteLength;

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
  const head = stepHead(1, "Profil wählen", "Rolle, Einstellungen und Packs in einem");
  if (ROLES.some((r) => customized(r.id))) {
    const reset = btn("fdghost fdright", "Auf Standard zurücksetzen");
    reset.title = "Jede Rolle wieder auf ihre eingebaute Pack-Vorauswahl, für alle künftigen Starts.";
    reset.onclick = resetPresets;
    head.append(reset);
  }
  sec.append(head);
  if (s.presetNote) sec.append(el("div", "fdnote warn", s.presetNote));
  const grid = el("div", "fdroles");
  grid.setAttribute("role", "radiogroup");
  grid.setAttribute("aria-label", "Profil");
  for (const r of ROLES) {
    const on = s.role === r.id;
    const b = btn(`fdrole${on ? " on" : ""}`);
    b.dataset.role = r.id;
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(on));
    b.disabled = isLaneEntry(s) && r.id !== "lane";
    if (b.disabled) b.title = "⎇+ startet eine Lane — andere Rollen über einen freien Slot.";
    const text = el("span", "fdrt");
    const size = s.sizes[r.id];
    const meta = r.id === "leer" ? "nichts geladen" : size === undefined ? (s.info?.git === false ? "kein Git-Repo" : "liest …")
      : size === null ? "Größe nicht lesbar" : kb(size);
    text.append(el("span", "fdrn", r.name), el("span", "fdrs", r.say),
      el("span", "fdrk", `${meta}${customized(r.id) ? " · angepasst" : ""}`));
    b.append(el("span", "fdglyph", r.glyph), text);
    b.onclick = () => setRole(r.id);
    hv(b, presetSay(r.id), size ? `Datei ${size.toLocaleString("de-DE")} B, Auftrag nicht mitgezählt` : "");
    grid.append(b);
  }
  sec.append(grid);
  if (s.role === "main") sec.append(progList());
  if (s.sizesFor !== sizesKey()) void loadSizes();
}

// what a profile hands over besides its role text, said in the tile's detail
function presetSay(r: Role): string {
  if (r === "main") return "Packs: der Plan der MAIN · bootstrap-main nimmt keine Auswahl mit";
  const p = presets[r];
  const n = p.base === "all" ? p.minus.length : p.plus.length;
  return p.base === "all" ? `Packs: alle passenden${n ? ` außer ${n}` : ""}` : n ? `Packs: ${n} gewählte` : "Packs: keine";
}

// THE PROFILES' OWN SIZES, read from the route as each would start here with its own agent and
// preset — the file alone, before any deviation of this session. Leer loads no file.
const sizesKey = (): string => `${S?.place ?? ""}|${JSON.stringify(presets)}|${agentHarnesses().map((h) => h.id).join()}`;
async function loadSizes() {
  const s = S;
  if (!s?.place || !s.info?.git) return;
  const key = sizesKey();
  const seq = ++s.sizesSeq;
  s.sizesFor = key;
  s.sizes = {};
  const place = s.place;
  const one = async (r: Role): Promise<number | null> => {
    const prof = profileOf(r);
    const harness = prof.harness ?? agentHarnesses().find((h) => h.default)?.id ?? "";
    const base = `/api/founding-plan?repo=${encodeURIComponent(place)}&harness=${encodeURIComponent(harness)}&mode=${r === "lane" ? "lane" : "main"}&role=${positionOf(r, r === "lane" ? "new" : "repo")}`;
    const read = async (q: string): Promise<Plan | null> => {
      const res = await api(q).catch(() => null);
      const j: unknown = res?.ok ? await res.json().catch(() => null) : null;
      return validPlan(j) ? j : null;
    };
    const full = await read(base);
    if (!full?.sessionAgents) return null;
    if (r === "main") return full.sessionAgents.bytes;
    const want = full.selected.filter((p) => presetHas(presets[r], p.id)).map((p) => p.id);
    if (want.length === full.selected.length) return full.sessionAgents.bytes;
    return (await read(`${base}&packs=${want.map(encodeURIComponent).join(",")}`))?.sessionAgents?.bytes ?? null;
  };
  const roles: Role[] = ["lane", "main", "orch"];
  const got = await Promise.all(roles.map(one));
  if (S !== s || seq !== s.sizesSeq) return; // latest-wins
  roles.forEach((r, i) => { s.sizes[r] = got[i] ?? null; });
  keepFocus(() => { renderRole(); renderFile(); });
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

function setRole(r: Role, why?: string) {
  const s = S;
  if (!s || (s.role === r && why === undefined)) return;
  const prev = s.role;
  s.role = r;
  s.error = null;
  s.touched.clear();
  s.parts.clear();
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
  if (!ROLE_PROFILE[s.role] || !agentHarnesses().some((a) => a.id === ROLE_PROFILE[s.role]?.harness)) return;
  const before = { harness: s.harness, model: s.model, effort: s.effort };
  const want = profileOf(s.role);
  s.harness = want.harness;
  s.model = want.model;
  s.effort = want.effort;
  s.profileFill = { harness: s.harness, model: s.model, effort: s.effort, before };
}

// A ROLE'S PROFILE VALUES: what ROLE_PROFILE fills where this machine runs that agent, else the
// door's defaults (no agent, model or effort named). A field off these is a deviation (design v3).
function profileOf(r: Role): Profile {
  const want = ROLE_PROFILE[r];
  const h = want ? agentHarnesses().find((a) => a.id === want.harness) : undefined;
  if (!want || !h) return { harness: null, model: "", effort: "" };
  return { harness: h.default ? null : h.id, model: h.supports.model ? want.id : "",
    effort: h.supports.effort && want.effort && h.effortLevels.includes(want.effort) ? want.effort : "" };
}

// the position the server renders the file for (context-packs.ts#CONTEXT_POSITIONS); Leer has none of
// its own and reads as its place does
type Position = "lane" | "main" | "orchestratorin";
const positionOf = (r: Role, m: Mode): Position =>
  r === "lane" ? "lane" : r === "main" ? "main" : r === "orch" ? "orchestratorin" : m === "repo" ? "main" : "lane";
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
  const label = why || s.delta?.why || "";
  s.delta = plus.length || minus.length ? { plus, minus, why: label } : null;
}

// --- PROFIL ---------------------------------------------------------------------------------------

function renderProfile() {
  const s = S;
  if (!s) return;
  const sec = s.fProfile;
  sec.replaceChildren();
  sec.append(el("div", "fdgl", "Einstellungen"));
  const h = chosenHarness();
  const prof = profileOf(s.role);
  if (!h) { sec.append(el("div", "fdnote", "Agenten werden gelesen …")); return; }
  const agents = agentHarnesses();
  // a value off the profile carries a dot and the profile's value; a click on it takes it back
  const was = (label: string, back: () => void): HTMLElement => {
    const b = btn("fdwas");
    b.append(el("i", "fddot2"), el("span", "", `Profil: ${label}`));
    b.title = "Zurück auf den Wert des Profils";
    b.onclick = () => { back(); s.error = null; renderAll(); };
    return b;
  };
  const harnessOf = (x: string | null): string => x ?? agents.find((a) => a.default)?.id ?? "";
  // Agent: one switch per agent this machine runs
  const agentRow = settingRow("Agent", "Welcher Agent in dieser Session läuft.");
  const seg = el("div", "fdsw2");
  seg.setAttribute("role", "radiogroup");
  seg.setAttribute("aria-label", "Agent");
  for (const a of agents) {
    const on = h.id === a.id;
    const b = btn(`fdsw2b${on ? " on" : ""}`, a.id);
    b.dataset.agent = a.id;
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(on));
    b.title = [a.allowsLanes === false ? "keine Lanes" : "", a.supports.container ? "im Container" : ""].filter(Boolean).join(" · ") || a.id;
    b.onclick = () => { pickHarness(a); renderAll(); };
    seg.append(b);
  }
  agentRow.v.append(seg);
  if (harnessOf(s.harness) !== harnessOf(prof.harness)) agentRow.v.append(was(harnessOf(prof.harness), () => {
    const back = agents.find((a) => a.id === harnessOf(prof.harness));
    if (back) pickHarness(back);
  }));
  sec.append(agentRow.row);
  if (h.supports.model) {
    const row = settingRow("Modell", s.model ? `Modell ${s.model}${filled("model") ? " — der MAIN-Standard aus dem Modellregister" : ""}` : "Ohne Angabe startet der Adapter sein eigenes.");
    row.v.append(profField("model", "Modell", s.model ? modelLabel(s.model) : modelShown(h), !s.model, false,
      s.model ? `Modell ${s.model}${filled("model") ? " — der MAIN-Standard aus dem Modellregister" : ""}` : "Ohne Angabe startet der Adapter sein eigenes."));
    if (s.model !== prof.model) row.v.append(was(prof.model ? modelLabel(prof.model) : "Adapter wählt", () => { s.model = prof.model; }));
    sec.append(row.row);
  }
  if (h.supports.effort && h.effortLevels.length) {
    const row = settingRow("Effort", filled("effort") ? "Der MAIN-Standard aus dem Modellregister." : "Wie gründlich der Agent denkt — ohne Angabe wählt der Adapter.");
    const eseg = el("div", "fdsw2");
    eseg.setAttribute("role", "radiogroup");
    eseg.setAttribute("aria-label", "Effort");
    for (const [v, label] of [["", "Adapter"], ...h.effortLevels.map((lv) => [lv, lv])] as [string, string][]) {
      const on = s.effort === v;
      const b = btn(`fdsw2b${on ? " on" : ""}`, label);
      b.dataset.effort = v;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(on));
      if (!v) b.title = "Ohne Angabe wählt der Adapter.";
      b.onclick = () => { s.effort = v; s.error = null; renderAll(); };
      eseg.append(b);
    }
    row.v.append(eseg);
    if (s.effort !== prof.effort) row.v.append(was(prof.effort || "Adapter", () => { s.effort = prof.effort; }));
    sec.append(row.row);
  }
  if (h.supports.container && s.role === "main") {
    const row = settingRow("Container", "Eine MAIN läuft ohne Container — bootstrap-main nimmt keinen.");
    row.v.append(el("span", "fdsoon", "ohne"));
    sec.append(row.row);
  } else if (h.supports.container) {
    const row = settingRow("Container", "Container und Docker-Daemon dieser Session — leer heißt der Fleet-Standard.");
    row.v.append(profField("container", "Container", s.container || containerDefaults?.container || "Fleet-Standard", !s.container, false,
      "Container und Docker-Daemon dieser Session — leer heißt der Fleet-Standard."));
    if (s.container || s.containerContext) row.v.append(was("Fleet-Standard", () => { s.container = ""; s.containerContext = ""; }));
    sec.append(row.row);
  }
  // RIGHTS ARE A PLACEHOLDER in design v3 (their own card); what holds today stays one hover away —
  // execution, her own work and the project views per role (G6.6, src/rights.ts#foundingRights)
  const prog = s.role === "main" ? s.progs?.find((x) => x.id === s.program)?.title ?? null : null;
  const rights = settingRow("Rechte", "");
  rights.row.tabIndex = 0;
  rights.v.append(el("span", "fdsoon", "kommen mit einer eigenen Karte"));
  const card = el("div", "fdhv fdhvrights");
  card.append(foundingRights(s.role, prog));
  rights.row.classList.add("fdrow");
  rights.row.append(card);
  sec.append(rights.row);
}

// one line of the settings: its name, then its switch; the tip is the line's own title
function settingRow(label: string, tip: string): { row: HTMLElement; v: HTMLElement } {
  const row = el("div", "fdsetrow");
  if (tip) row.title = tip;
  const v = el("div", "fdsetv");
  row.append(el("span", "fdsetk", label), v);
  return { row, v };
}

// the agent switch: what belongs to the agent being left never rides along to the next one
function pickHarness(a: HarnessInfo) {
  const s = S!;
  // a model the role filled belongs to the role's agent, and never rides to another one
  const pf = s.profileFill;
  if (pf && filled("model") && (a.default ? null : a.id) !== pf.harness) s.model = "";
  s.harness = a.default ? null : a.id;
  if (!a.supports.effort || !a.effortLevels.includes(s.effort)) s.effort = "";
  if (!a.supports.model) s.model = "";
  if (!a.supports.container) { s.container = ""; s.containerContext = ""; }
  s.error = null;
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
  if (which === "model" && h) {
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

// --- ② PACKS and ③ THE FILE ------------------------------------------------------------------------

// the plan hangs off (place, harness, mode, position); a change of any of them reads it again
function planKey(): string {
  const s = S!;
  return `${s.place ?? ""}|${s.harness ?? harnesses.find((h) => h.default)?.id ?? ""}|${s.mode === "repo" ? "main" : "lane"}|${positionOf(s.role, s.mode)}`;
}

// THE FULL PLAN: every pack this start can carry, each with its parts and their default place — the
// tree's source. It is read without packs= and parts=, so a part's size is known while it is off.
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
  const role = positionOf(s.role, s.mode);
  try {
    const res = await api(`/api/founding-plan?repo=${encodeURIComponent(path)}&harness=${encodeURIComponent(harness)}&mode=${mode}&role=${role}`);
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
        // AN AGENT CHANGE RE-PLANS, and says so: what leaves for a reason of the plan is named
        // with that reason (s.dropped) — never a silent swap
        const now = s.plan.harness ?? null;
        const moved = s.planHarness !== null && now !== null && now !== s.planHarness;
        s.planHarness = now;
        applyPreset(moved ? `Agent → ${now}` : "");
        // a part the plan no longer has is no deviation any more
        const known = new Set(planParts(s.plan).map((x) => x.part.id));
        for (const id of [...s.parts.keys()]) if (!known.has(id)) s.parts.delete(id);
      }
      keepFocus(() => { renderRole(); renderPacks(); renderFile(); renderFoot(); });
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
    && (r.refusal === null || r.refusal === "source-unavailable" || r.refusal === "source-anchor-missing");
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

// THE FOUR GROUPS of design v3, keyed by when a pack is needed (context-packs.ts#CONTEXT_PACK_GROUPS).
// The pack's own `group` decides; a server without the field puts nothing in a guessed group.
const GROUPS: { id: string; name: string; say: string }[] = [
  { id: "grundlagen", name: "Grundlagen", say: "Was jede Session immer bindet." },
  { id: "pruefen-landen", name: "Prüfen und Landen", say: "Wann eine Änderung bewiesen ist und was beim Landen geschieht." },
  { id: "sessions-fuehren", name: "Sessions führen", say: "Agent-Programme anbinden, Watches setzen, Nachfolge." },
  { id: "vor-arbeiten", name: "Vor bestimmten Arbeiten", say: "Was gilt, bevor du das Regelbuch änderst, misst oder Jev einsetzt." },
];
const UNGROUPED = { id: "ohne", name: "Ohne Gruppe", say: "Der Server nennt für diese Packs keine Gruppe." };
const groupOf = (p: FoundingPlanPack) => GROUPS.find((g) => g.id === p.group) ?? UNGROUPED;

// the words of the view for the packs and parts this tree has (design v3 §0, "Wörter der Ansicht");
// a pack or part without words here is named by its own declaration, never by a guess
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
};
const PART_WORDS: Record<string, string> = {
  "portable-core.contract": "ganzer Abschnitt",
  "verify-e2e.kern": "Grundregeln des Prüfens", "verify-e2e.lane": "Schritte einer Lane", "verify-e2e.main": "Schritt einer MAIN",
  "verify-e2e.more": "Sonderfälle", "verify-e2e.gate-vs-audit": "Was vor und was nach dem Landen geprüft wird",
  "verify-e2e.proportion": "Wie viel Prüfung eine Änderung braucht",
  "land-mechanics.landing": "Kurzfassung", "land-mechanics.doc": "Was beim Landen geschieht",
  "harness-adapter.harnesses": "Liste der Agent-Programme", "harness-adapter.container": "Der Container-Harness",
  "jev-use.verwendungsform": "Verwendungsform", "konzept-claude-fleet.private": "ganze Fassung, privat",
};
const packName = (p: FoundingPlanPack): string => PACK_WORDS[p.id]?.name ?? p.id;
const packSay = (p: FoundingPlanPack): string => PACK_WORDS[p.id]?.say ?? p.useWhen ?? "";
function partName(x: FoundingPlanPart): string {
  if (PART_WORDS[x.id]) return PART_WORDS[x.id]!;
  if (x.privateSourceId) return "ganze Fassung, privat";
  // a whole-file anchor (one #) is the file; a heading is its words without the hashes
  if (!x.anchor || /^# /.test(x.anchor)) return x.path ? `ganze Datei ${baseName(x.path)}` : "ganzer Abschnitt";
  return x.anchor.replace(/^#+\s*/, "").replace(/\s*[—–-].*$/, "").trim() || x.anchor;
}

// every part of the plan with its pack; a part's DEFAULT place is the one the full plan rendered
function planParts(plan: Plan): { pack: FoundingPlanPack; part: FoundingPlanPart }[] {
  return plan.selected.flatMap((pack) => (pack.parts ?? []).map((part) => ({ pack, part })));
}
type PartOrt = "box" | "ausleihe";
const partOrt = (x: FoundingPlanPart): PartOrt => S?.parts.get(x.id) ?? x.ort;
// a part whose source this plan could not cut cannot be put whole into the file
const partFixed = (x: FoundingPlanPart): string | null =>
  x.privateSourceId ? "Privat: der Text dieser Quelle kommt nie in die Datei, nur ihr Hinweis."
  : x.refusal === "source-unavailable" ? "Die Quelle liegt an diesem Stand nicht im Repo."
  : x.refusal === "source-anchor-missing" ? "Die Überschrift der Quelle fehlt an diesem Stand." : null;

// whether this start can change its packs at all: a MAIN's door takes none, a continued worktree gets none
const packsFixed = (): string | null => {
  const s = S!;
  if (s.role === "main") return "Die Gründungstür einer MAIN nimmt keine Packs — sie liest den Plan der MAIN.";
  if (s.mode === "old") return "Ein fortgesetzter Worktree bekommt keine Packs — sie gehen nur bei einer frischen Gründung mit.";
  return null;
};

function renderPacks() {
  const s = S;
  if (!s) return;
  const sec = s.fPacks;
  sec.replaceChildren();
  const head = el("div", "fdgl", "Packs");
  sec.append(head);
  if (!s.info?.git) {
    sec.append(el("div", "fdnote", s.info ? "Kein Git-Repo — hier gibt es keine Packs." : "Wird gelesen, sobald der Ort feststeht."));
    return;
  }
  if (s.planFor !== planKey()) void loadPlan();
  if (s.planErr) { sec.append(el("div", "fdnote warn", `${s.planErr} Der Start geht dann ohne Packs.`)); return; }
  if (!s.plan || s.planFor !== planKey()) { sec.append(el("div", "fdnote", "Plan wird gelesen …")); return; }
  const plan = s.plan;
  const fixed = packsFixed();
  const tree = el("div", "fdtree");
  const groups = [...GROUPS, UNGROUPED].filter((g) => g !== UNGROUPED || plan.selected.some((p) => groupOf(p) === UNGROUPED));
  for (const g of groups) {
    const packs = plan.selected.filter((p) => groupOf(p) === g);
    const on = packs.filter((p) => packOn(p.id));
    const node = el("div", "fdnode");
    const open = s.open.has(g.id);
    const line = el("div", "fdline");
    line.append(chevron(g.id, open, packs.length > 0, `${g.name} ${open ? "zuklappen" : "aufklappen"}`));
    const tx = el("div", "fdtx");
    const nm = el("div", "fdnm");
    if (packs.some((p) => s.touched.has(p.id))) nm.append(dotBack(`${g.name}: Packs wie Profil`, () => { for (const p of packs) s.touched.delete(p.id); applyPreset(""); }));
    nm.append(el("b", "", g.name), el("span", "fdcnt", packs.length ? `${on.length} von ${packs.length}` : "keine für diesen Start"));
    tx.append(nm, el("div", "fdgsay", g.say));
    line.append(tx, el("span", `fdkb${on.length ? "" : " off"}`, on.length ? contribution(on) : "aus"));
    const sw = switchBtn(on.length === packs.length && packs.length > 0 ? "on" : on.length ? "mixed" : "off", `Gruppe ${g.name}`);
    sw.dataset.group = g.id;
    sw.disabled = !packs.length || !!fixed;
    if (fixed) sw.title = fixed;
    // a group that is not all on switches all on; one that is all on switches all off (design v3 §0.3)
    sw.onclick = () => { const all = on.length === packs.length; for (const p of packs) setPack(p.id, !all); afterPackChange(`[data-group="${CSS.escape(g.id)}"]`); };
    line.append(sw);
    node.append(hv(line, packs.length ? `${packs.map((p) => p.id).join(", ")}` : ""));
    if (open) {
      const kids = el("div", "fdkids");
      for (const p of packs) kids.append(packNode(p, plan, fixed));
      node.append(kids);
    }
    tree.append(node);
  }
  sec.append(tree);
  for (const d of s.dropped) sec.append(el("div", "fdnote warn", `${packNameById(d.id)} fällt mit diesem Plan weg: ${d.why}.`));
  if (plan.omitted.length) {
    const off = el("div", "fdnote fdrow");
    off.tabIndex = 0;
    off.append(el("span", "", `${plan.omitted.length} ${plan.omitted.length === 1 ? "weiteres Pack passt" : "weitere Packs passen"} nicht zu diesem Start.`));
    hv(off, ...plan.omitted.map((o) => `${o.id} · ${OMIT_SAY[o.reason] ?? o.reason}${o.harnesses?.length ? ` (nur ${o.harnesses.join(", ")})` : ""} · intern: ${o.reason}`));
    sec.append(off);
  }
  const note = el("div", "fdpknote");
  note.append(document.createTextNode(`${plan.selected.length} ${plan.selected.length === 1 ? "Pack" : "Packs"} in ${groups.length} Gruppen. `),
    el("b", "", "Gruppe und Pack"), document.createTextNode(" an: ein Hinweis in der Datei. "),
    el("b", "", "Teil"), document.createTextNode(" an: sein Text ganz in der Datei — heute in dieser Vorschau; der Start trägt die Packs."));
  sec.append(note);
  if (fixed) sec.append(el("div", "fdnote", fixed));
}
// a MAIN's file renders her whole plan (her door takes no choice), so every pack of it reads as on
const packOn = (id: string): boolean => S?.role === "main" || !!S?.packs.has(id);
const packNameById = (id: string): string => { const p = S?.plan?.selected.find((x) => x.id === id); return p ? packName(p) : PACK_WORDS[id]?.name ?? id; };

function packNode(p: FoundingPlanPack, plan: Plan, fixed: string | null): HTMLElement {
  const s = S!;
  const node = el("div", "fdnode fdlv1");
  const parts = p.parts ?? [];
  const isOn = packOn(p.id);
  const open = s.open.has(p.id);
  const line = el("div", "fdline");
  line.append(chevron(p.id, open, parts.length > 0, `${packName(p)} ${open ? "zuklappen" : "aufklappen"}`));
  const tx = el("div", "fdtx");
  const nm = el("div", "fdnm");
  if (s.touched.has(p.id)) nm.append(dotBack(`${packName(p)}: wie Profil`, () => { s.touched.delete(p.id); applyPreset(""); }));
  const whole = parts.filter((x) => partOrt(x) === "box").length;
  nm.append(el("span", "fdn2", packName(p)));
  if (whole) nm.append(el("span", "fdcnt", `${whole} von ${parts.length} ganz darin`));
  tx.append(nm);
  line.append(tx, el("span", `fdkb${isOn ? "" : " off"}`, isOn ? contribution([p]) : "aus"));
  const sw = switchBtn(isOn ? "on" : "off", `Pack ${packName(p)}`);
  sw.dataset.pack = p.id;
  sw.disabled = !!fixed;
  if (fixed) sw.title = fixed;
  sw.onclick = () => { setPack(p.id, !isOn); afterPackChange(`[data-pack="${CSS.escape(p.id)}"]`); };
  line.append(sw);
  const src = isPrivate(p.anchors) ? `privat · ${p.anchors.privateSourceId}` : p.source === "fleet-seed" ? "aus der Fleet" : "aus dem Repo";
  const hint = s.file ? hintBytes(s.file.text).get(p.id) : undefined;
  node.append(hv(line, packSay(p), `${p.id} · ${src}${hint !== undefined ? ` · Hinweis ${hint} B` : ""}${p.sourceHash ? ` · ${short(p.sourceHash, 8)}` : ""}`));
  if (open) {
    const kids = el("div", "fdkids");
    for (const x of parts) kids.append(partNode(p, x, isOn));
    node.append(kids);
  }
  return node;
}

function partNode(p: FoundingPlanPack, x: FoundingPlanPart, packOn: boolean): HTMLElement {
  const s = S!;
  const node = el("div", "fdnode fdlv2");
  const line = el("div", "fdline");
  const ort = partOrt(x);
  const tx = el("div", "fdtx");
  const nm = el("div", "fdnm");
  if (s.parts.has(x.id)) nm.append(dotBack(`${partName(x)}: wie Profil`, () => { s.parts.delete(x.id); }));
  nm.append(el("span", "fdn2", partName(x)));
  tx.append(nm);
  line.append(el("span", "fdchev none"), tx, el("span", `fdkb${ort === "box" && packOn ? "" : " off"}`, x.bytes === null ? "—" : kb(x.bytes)));
  const sw = switchBtn(ort === "box" && packOn ? "on" : "off", `Teil ${partName(x)} ganz in die Datei`);
  sw.dataset.part = x.id;
  const why = partFixed(x) ?? (packOn ? null : "Das Pack ist aus — schalte es an, dann kann der Teil ganz hinein.");
  sw.disabled = !!why;
  if (why) sw.title = why;
  sw.onclick = () => {
    const next: PartOrt = ort === "box" ? "ausleihe" : "box";
    if (next === x.ort) s.parts.delete(x.id); else s.parts.set(x.id, next);
    afterPackChange(`[data-part="${CSS.escape(x.id)}"]`);
  };
  line.append(sw);
  const where = x.privateSourceId ? `privat · ${x.privateSourceId}` : `${x.path ?? "?"} | ${x.anchor ?? "?"}`;
  node.append(hv(line, `${x.sorte === "anleitung" ? "Anleitung" : "Wissen"} · ${where}`,
    `${x.id}${x.sha256 ? ` · ${x.sha256.slice(0, 8)}` : ""}${x.bytes !== null ? ` · ${x.bytes.toLocaleString("de-DE")} B` : ""}`));
  return node;
}

function chevron(id: string, open: boolean, has: boolean, label: string): HTMLElement {
  const s = S!;
  if (!has) return el("span", "fdchev none");
  const b = btn("fdchev");
  b.dataset.fold = id;
  b.setAttribute("aria-expanded", String(open));
  b.setAttribute("aria-label", label);
  b.append(icon("chevron"));
  b.onclick = () => {
    if (open) s.open.delete(id); else s.open.add(id);
    renderPacks();
    s.fPacks.querySelector<HTMLElement>(`[data-fold="${CSS.escape(id)}"]`)?.focus();
  };
  return b;
}
function switchBtn(state: "on" | "off" | "mixed", label: string): HTMLButtonElement {
  const b = btn(`fdsw ${state}`);
  b.setAttribute("role", "switch");
  b.setAttribute("aria-checked", state === "mixed" ? "mixed" : String(state === "on"));
  b.setAttribute("aria-label", label);
  return b;
}
// the deviation dot: a click takes this one deviation back (design v3: "Punkt mit Rücksetzen")
function dotBack(label: string, back: () => void): HTMLElement {
  const b = btn("fddvb");
  b.setAttribute("aria-label", label);
  b.title = "Weicht vom Profil ab — ein Klick setzt zurück";
  b.append(el("i", "fddot2"));
  b.onclick = (e) => { e.stopPropagation(); back(); afterPackChange(null); };
  return b;
}

// the packs' share of the file: their parts that stand whole in it plus their hint lines, measured
// on the file the route rendered — "…" while that file is being read
function contribution(packs: FoundingPlanPack[]): string {
  const s = S!;
  if (fileKey() === null) return "an";
  if (!s.file || s.fileFor !== fileKey()) return "…";
  const hints = hintBytes(s.file.text);
  const ids = new Set(packs.map((p) => p.id));
  const bytes = s.file.parts.filter((x) => x.packId !== null && ids.has(x.packId) && x.ort === "box" && x.content !== null)
    .reduce((n, x) => n + (x.bytes ?? 0), 0) + packs.reduce((n, p) => n + (hints.get(p.id) ?? 0), 0);
  return kb(bytes);
}

function setPack(id: string, on: boolean) {
  const s = S!;
  const preset = presetHas(presets[s.role], id);
  if (on === preset) s.touched.delete(id); else s.touched.set(id, on);
  if (on) s.packs.add(id); else s.packs.delete(id);
  s.delta = null;
  s.error = null;
}
function togglePack(id: string, on: boolean) {
  setPack(id, on);
  afterPackChange(`[data-pack="${CSS.escape(id)}"]`);
}
// one repaint after a switch; the switch that was pressed keeps the focus
function afterPackChange(focus: string | null) {
  const s = S;
  if (!s) return;
  renderPacks();
  renderFile();
  renderFoot();
  if (focus) s.fPacks.querySelector<HTMLElement>(focus)?.focus();
}

// --- ③ the file --------------------------------------------------------------------------------------

// the file hangs off the plan and every switch: the packs that are on and the parts that stand whole
function fileQuery(): string | null {
  const s = S!;
  if (!s.place || !s.plan || s.planFor !== planKey() || s.role === "leer" || s.mode === "old") return null;
  const harness = s.harness ?? harnesses.find((h) => h.default)?.id ?? "";
  const mode = s.mode === "repo" ? "main" : "lane";
  const box = planParts(s.plan).filter(({ part }) => partOrt(part) === "box").map(({ part }) => part.id);
  // a MAIN's door builds her plan itself: her file renders the whole plan, never a pack choice
  const packs = s.role === "main" ? "" : `&packs=${[...s.packs].filter((id) => s.plan!.selected.some((p) => p.id === id)).map(encodeURIComponent).join(",")}`;
  return `/api/founding-plan?repo=${encodeURIComponent(s.place)}&harness=${encodeURIComponent(harness)}&mode=${mode}&role=${positionOf(s.role, s.mode)}${packs}&parts=${box.map(encodeURIComponent).join(",")}`;
}
const fileKey = (): string | null => S ? fileQuery() : null;

async function loadFile() {
  const s = S;
  const q = fileKey();
  if (!s || !q) return;
  const seq = ++s.fileSeq;
  s.filePending = q;
  let err: string | null = null, file: FoundingSessionAgents | null = null;
  try {
    const res = await api(q);
    const j: unknown = await res.json().catch(() => null);
    if (S !== s || seq !== s.fileSeq) return; // latest-wins
    if (res.status === 404) err = SKEW_NOTE;
    else if (!res.ok || !validPlan(j)) err = `Die Datei ist nicht lesbar (Antwort ${res.status}).`;
    else if (!j.sessionAgents) err = "Dieser Server rendert die Datei noch nicht.";
    else file = j.sessionAgents;
  } catch {
    if (S !== s || seq !== s.fileSeq) return;
    err = "Die Datei konnte nicht geladen werden.";
  }
  // the answer belongs to its query: the file and its key move together, an error keeps neither
  s.filePending = null;
  s.fileErr = err;
  s.fileFor = q;
  if (file) s.file = file;
  keepFocus(() => { renderPacks(); renderFile(); });
}

// THE HINT LINES under "## Packs auf Abruf", measured on the rendered text: one entry per pack,
// starting with "- <pack id>" (session-agents.ts#renderSessionAgents). The section ends where the
// fixed close begins, the last heading the renderer writes.
const POINTER_HEAD = "## Packs auf Abruf\n\n";
function pointerBlock(text: string): string | null {
  const ends = ["\n\n## Lane-Ende\n\n", "\n\n## Program-Schiene\n\n"].map((h) => text.lastIndexOf(h)).filter((i) => i >= 0);
  const end = ends.length ? Math.max(...ends) : text.replace(/\n$/, "").length;
  const start = text.lastIndexOf(POINTER_HEAD, end);
  return start < 0 ? null : text.slice(start + POINTER_HEAD.length, end);
}
function hintBytes(text: string): Map<string, number> {
  const out = new Map<string, number>();
  const block = pointerBlock(text);
  if (!block) return out;
  for (const entry of block.split(/\n(?=- )/)) {
    const id = /^- (\S+)/.exec(entry)?.[1];
    if (id) out.set(id, bytesOf(entry) + 1);
  }
  return out;
}

interface FileSection { k: string; h: string; say: string; bytes: number | null; label?: string; items: { name: string; names?: string; bytes: number | null; dev: boolean; hv: string[] }[]; hv: string[]; dev: boolean }

function renderFile() {
  const s = S;
  if (!s) return;
  const sec = s.fFile;
  sec.replaceChildren();
  sec.append(stepHead(3, "Was der Agent liest", "jede Änderung links erscheint hier sofort"));
  const none = (text: string) => { sec.append(el("div", "fdnofile", text)); };
  if (s.role === "leer") return none("Ohne Rolle lädt dieses Profil keine Datei. Was du links anschaltest, geht als Pack mit.");
  if (s.mode === "old") return none("Ein fortgesetzter Worktree bekommt keine neue Datei — er arbeitet weiter mit dem, was er hat.");
  if (!s.info?.git) return none(s.info ? "Kein Git-Repo — hier gibt es keine Datei." : "Wird gelesen, sobald der Ort feststeht.");
  if (s.planErr) return none(s.planErr);
  const q = fileKey();
  if (q && s.fileFor !== q && s.filePending !== q) void loadFile();
  if (s.fileErr && s.fileFor === q) return none(s.fileErr);
  const file = s.file;
  if (!file) return none("Die Datei wird gelesen …");
  const stale = s.fileFor !== q;
  const h = chosenHarness();
  const role = file.parts.find((x) => x.id === "role");
  const footer = file.parts.find((x) => x.id === "footer");
  const packOf = (x: FoundingPlanPart) => s.plan?.selected.find((p) => p.id === x.packId);
  const whole = (sorte: "anleitung" | "wissen") => file.parts.filter((x) => x.packId !== null && x.sorte === sorte && x.ort === "box" && x.content !== null);
  const item = (x: FoundingPlanPart) => ({ name: partName(x), bytes: x.bytes, dev: s.parts.has(x.id),
    hv: [`${packOf(x) ? packName(packOf(x)!) : x.packId ?? ""} · ${x.path ?? ""} | ${x.anchor ?? ""}`, `${x.id}${x.sha256 ? ` · ${x.sha256.slice(0, 8)}` : ""}`] });
  const sum = (xs: FoundingPlanPart[]) => xs.reduce((n, x) => n + (x.bytes ?? 0), 0);
  const anl = whole("anleitung"), wis = whole("wissen");
  const block = pointerBlock(file.text);
  const hints = hintBytes(file.text);
  const hinted = [...hints.keys()];
  const groupsHinted = [...GROUPS, UNGROUPED].map((g) => {
    const packs = (s.plan?.selected ?? []).filter((p) => groupOf(p) === g && hints.has(p.id));
    return { g, packs };
  }).filter((x) => x.packs.length);
  const pos = positionOf(s.role, s.mode);
  const secs: FileSection[] = [
    { k: "rolle", h: "Rolle", say: "Wer der Agent ist, was er selbst entscheidet und an wen er meldet.", bytes: role?.bytes ?? null, items: [], dev: false,
      hv: role ? [`${role.path ?? ""} · ${role.anchor ?? ""}${role.sha256 ? ` · ${role.sha256.slice(0, 8)}` : ""}`] : [] },
    { k: "auftrag", h: "Auftrag", say: `${s.role === "main" ? "Das Program, das sie führt." : "Die Karte dieses Starts."} Kommt beim Start dazu.`, bytes: null, label: "beim Start", items: [], dev: false, hv: [] },
    { k: "anl", h: "Anleitung", say: anl.length ? "Regeln und Schritte, die er bei jeder Arbeit befolgt, ganz in der Datei." : "Keine Schritte ganz in der Datei.",
      bytes: anl.length ? sum(anl) : null, items: anl.map(item), dev: anl.some((x) => s.parts.has(x.id)) || planDeviates("anleitung"), hv: [] },
    { k: "wis", h: "Wissen", say: wis.length ? "Hintergrund, der die Schritte erklärt, ganz in der Datei." : "Nichts ganz in der Datei. Hintergrund liest er bei Bedarf nach.",
      bytes: wis.length ? sum(wis) : null, items: wis.map(item), dev: wis.some((x) => s.parts.has(x.id)) || planDeviates("wissen"), hv: [] },
    { k: "abruf", h: "Packs auf Abruf", say: hinted.length ? `Wo er bei Bedarf nachliest: ${hinted.length} ${hinted.length === 1 ? "Hinweis" : "Hinweise"}, nicht der Text.` : "Keine Hinweise.",
      bytes: block === null || !hinted.length ? null : bytesOf(block),
      items: groupsHinted.map(({ g, packs }) => ({ name: g.name, names: packs.map(packName).join(", "), dev: packs.some((p) => s.touched.has(p.id)),
        bytes: packs.reduce((n, p) => n + (hints.get(p.id) ?? 0), 0), hv: packs.map((p) => `${p.id} · Hinweis ${hints.get(p.id)} B`) })),
      dev: s.touched.size > 0, hv: [] },
    { k: "ende", h: "Schluss", say: pos === "lane" ? "Wie sie am Ende abgibt: committen, melden, still werden."
        : footer ? "Wie sie ihr Program führt und berichtet." : "Dieses Profil hat keinen festen Schluss.",
      bytes: footer?.bytes ?? null, items: [], dev: false,
      hv: footer ? [`${footer.path ?? ""} · ${footer.anchor ?? ""}${footer.sha256 ? ` · ${footer.sha256.slice(0, 8)}` : ""}`] : [] },
  ];
  // what changed since the last paint lights up once (design v3: "kurzes Aufleuchten")
  const now = new Map(secs.map((x) => [x.k, x.bytes ?? -1]));
  if (s.shown && !stale) for (const [k, v] of now) if (s.shown.get(k) !== v) s.flash.add(k);
  if (!stale) s.shown = now;

  const head = el("div", "fdfh");
  const name = el("div", "fdfn");
  name.append(icon("file"), el("span", "", "AGENTS.md dieser Session"));
  head.append(name, el("span", "fdtot", kb(file.bytes)));
  const where = { claude: "CLAUDE.local.md", codex: "AGENTS.override.md" }[h?.id ?? ""] ?? "eine eigene Datei für den Agenten";
  sec.append(hv(head, `So rendert der Server die Datei dieser Session · ${file.bytes.toLocaleString("de-DE")} B, Überschriften mitgezählt`,
    `Ort beim Agenten laut Messung 2026-10-03: ${where} · zugestellt wird heute der Gründungsbrief, das Receipt sagt, was ankam`));
  const sub = el("div", "fdfsub");
  const prof = [h?.id ?? "", s.model ? modelLabel(s.model) : h ? modelShown(h) : "", s.effort].filter(Boolean).join(" · ");
  sub.append(el("span", "", `Startet mit ${prof}`));
  const alone = s.sizes[s.role];
  if (typeof alone === "number") sub.append(el("span", "fdvs", `Profil ${ROLES.find((r) => r.id === s.role)!.name} allein: ${kb(alone)}`));
  sec.append(sub);
  const doc = el("div", `fddoc${stale ? " stale" : ""}`);
  secs.forEach((x, i) => {
    const row = el("div", `fdsec2${x.bytes === null && !x.label ? " empty" : ""}${x.dev ? " dev" : ""}${s.flash.has(x.k) ? " flash" : ""}`);
    row.dataset.sec = x.k;
    row.append(el("span", "fdno", String(i + 1)), el("span", "fdh", x.h),
      el("span", "fdskb", x.label ?? (x.bytes === null ? "—" : kb(x.bytes))), el("span", "fdsay2", x.say));
    if (x.items.length) {
      const items = el("div", "fditems");
      for (const it of x.items) {
        const r = el("div", "fdit");
        r.tabIndex = 0;
        if (it.dev) r.append(el("i", "fddot2"));
        r.append(el("span", "fdinm", it.name));
        if (it.names) r.append(el("span", "fdnames", it.names));
        r.append(el("span", "fdx", it.bytes === null ? "—" : kb(it.bytes)));
        items.append(hv(r, ...it.hv));
      }
      row.append(items);
    }
    if (x.bytes !== null) {
      const bar = el("span", "fdbar");
      const fill = el("i", "");
      fill.style.setProperty("--w", `${Math.min(100, (x.bytes / Math.max(1, file.bytes)) * 100).toFixed(1)}%`);
      bar.append(fill);
      row.append(bar);
    }
    if (x.hv.length) { row.tabIndex = 0; hv(row, ...x.hv); }
    doc.append(row);
  });
  sec.append(doc);
  sec.append(el("div", "fdffoot", "Die Reihenfolge ist fest, jede Aussage steht nur einmal darin. Der Auftrag zählt nicht mit, er kommt beim Start dazu."));
  if (file.projectDocMaxBytes) sec.append(el("div", "fdnote warn", `Die Datei ist größer als 32 KB (${file.projectDocMaxBytes.toLocaleString("de-DE")} B) — ein Agent liest dann womöglich nicht alles.`));
  if (s.flash.size) {
    const flash = s.flash;
    setTimeout(() => { if (S === s && s.flash === flash) { s.flash = new Set(); s.fFile.querySelectorAll(".flash").forEach((e) => e.classList.remove("flash")); } }, 900);
  }
}
// a part of this sorte the owner moved out of the file still marks its section as changed
function planDeviates(sorte: "anleitung" | "wissen"): boolean {
  const s = S!;
  return !!s.plan && planParts(s.plan).some(({ part }) => part.sorte === sorte && s.parts.get(part.id) === "ausleihe");
}

// WHAT A PACK IS, in the words the receipt shares: a fassung only where the id declares one
// (src/protocol.ts#packIdFassung)
const isPrivate = (a: PackAnchors | undefined): a is { privateSourceId: string } => !!a && !Array.isArray(a);
const fassungSay = (id: string): string => {
  const n = packIdFassung(id);
  return n === null ? "keine Fassung deklariert" : `Fassung v${n} · laut Paket-ID`;
};
const short = (sha: string | undefined | null, n: number): string => sha ? sha.slice(0, n) : "nicht gemeldet";

// THE STORE. Read once per window; a role the store does not name keeps its built-in preset. A
// store that cannot be read is SAID under the profiles — the built-in presets then apply, which is
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
    if (S === s) { renderRole(); renderPacks(); renderFile(); renderFoot(); }
  }
}

// only the roles the owner changed are stored, so a later change of a built-in preset still
// reaches every role nobody redrew; none changed is the reset
async function savePresets() {
  const s = S;
  if (!s) return;
  const changed = { ...presetsForeign, ...Object.fromEntries(ROLES.filter((r) => customized(r.id)).map((r) => [r.id, presets[r.id]])) };
  s.presetState = "saving";
  renderFoot();
  const res = await post("/api/role-presets", { presets: Object.keys(changed).length ? changed : null }).catch(() => null);
  if (S !== s) return;
  if (res?.ok) { s.presetState = "saved"; s.presetNote = null; }
  else {
    const j = res ? (await res.json().catch(() => null)) as { error?: string } | null : null;
    s.presetState = "error";
    s.presetNote = `Nicht gesichert: ${j?.error ?? (res ? `Antwort ${res.status}` : "der Server ist nicht erreichbar")}. Für dieses Fenster gilt die Änderung trotzdem.`;
  }
  s.sizesFor = null;
  renderRole();
  renderFoot();
}

function resetPresets() {
  const s = S;
  if (!s) return;
  presets = clonePresets(PRESET_DEFAULT);
  s.touched.clear();
  applyPreset("Vorauswahl zurückgesetzt");
  renderAll();
  void savePresets();
}

// "ALS PROFIL SICHERN": the pack switches of this session become the role's preset, over the existing
// preset door, for every later start. The preset holds packs only (src/protocol.ts#RolePreset) — the
// parts and the settings stay this session's, and the button's title says so.
function saveAsProfile() {
  const s = S;
  if (!s?.plan || s.role === "main") return;
  const ids = s.plan.selected.map((p) => p.id);
  const p = presets[s.role];
  presets = { ...presets, [s.role]: p.base === "all"
    ? { base: "all", plus: [], minus: [...new Set([...p.minus.filter((id) => !ids.includes(id)), ...ids.filter((id) => !s.packs.has(id))])] }
    : { base: "none", plus: [...new Set([...p.plus.filter((id) => !ids.includes(id)), ...ids.filter((id) => s.packs.has(id))])], minus: [] } };
  s.touched.clear();
  applyPreset("");
  renderAll();
  void savePresets();
}

// EVERY DEVIATION of this session from its profile, in words: the settings, the packs, the parts
function deviations(): string[] {
  const s = S!;
  const out: string[] = [];
  const prof = profileOf(s.role);
  const def = agentHarnesses().find((h) => h.default)?.id ?? "";
  if ((s.harness ?? def) !== (prof.harness ?? def)) out.push(`Agent ${s.harness ?? def}`);
  if (s.model !== prof.model) out.push(`Modell ${s.model ? modelLabel(s.model) : "Adapter wählt"}`);
  if (s.effort !== prof.effort) out.push(`Effort ${s.effort || "Adapter"}`);
  if (s.container || s.containerContext) out.push(`Container ${s.container || s.containerContext}`);
  for (const [id, on] of s.touched) {
    const p = s.plan?.selected.find((x) => x.id === id);
    out.push(`${p ? `${groupOf(p).name} › ` : ""}${packNameById(id)} ${on ? "dazu" : "weggelassen"}`);
  }
  for (const [id, ort] of s.parts) {
    const hit = s.plan ? planParts(s.plan).find((x) => x.part.id === id) : undefined;
    out.push(`${hit ? `${packName(hit.pack)} › ${partName(hit.part)}` : id} ${ort === "box" ? "ganz darin" : "nur als Hinweis"}`);
  }
  return out;
}

// "WIE PROFIL": every deviation back at once — settings, packs and parts
function likeProfile() {
  const s = S;
  if (!s) return;
  const prof = profileOf(s.role);
  s.harness = prof.harness; s.model = prof.model; s.effort = prof.effort;
  s.container = ""; s.containerContext = "";
  s.touched.clear();
  s.parts.clear();
  s.error = null;
  applyPreset("");
  renderAll();
}

// --- the foot: one sentence, the deviations, and the one button --------------------------------------

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
  // the deviations from the profile, counted; their words on hover, and the way back
  const devs = deviations();
  const dev = el("div", "fddev");
  if (devs.length) {
    const n = el("span", "fddevn fdrow");
    n.tabIndex = 0;
    n.append(el("i", "fddot2"), el("span", "", `Diese Session weicht in ${devs.length} ${devs.length === 1 ? "Punkt" : "Punkten"} vom Profil ab`));
    hv(n, ...devs);
    const back = btn("fdghost fdlike", "Wie Profil");
    back.prepend(icon("reload"));
    back.title = "Alle Abweichungen zurück auf das Profil";
    back.onclick = likeProfile;
    dev.append(n, back);
  } else dev.append(el("span", "fddevn quiet", `Wie Profil ${ROLES.find((r) => r.id === s.role)!.name}`));
  if (s.presetState === "saved" || s.presetState === "saving")
    dev.append(el("span", "fdmeta", s.presetState === "saving" ? "Wird gesichert …" : "Gesichert — gilt für alle künftigen Starts."));
  // a plan nobody could read starts without packs — allowed, but never silently
  const planGone = !!s.planErr && s.mode !== "old" && !!s.info?.git && s.role !== "main";
  // bootstrap-main picks the free MAIN place itself — the clicked one is a likely answer, not a promise
  const seat = s.role === "main" && s.entry.kind === "slot" ? `Den Platz wählt der Server — nicht unbedingt Slot ${s.entry.slot}.` : null;
  const why = s.error ?? blocker() ?? (planGone ? "Der Plan für diesen Start ist nicht lesbar — er startet ohne Packs." : seat);
  const note = el("div", `fdfootnote${s.error || planGone ? " warn" : ""}`, why ?? "");
  const keep = btn("fdghost fdkeep", "Als Profil sichern");
  const packsChanged = s.touched.size > 0;
  keep.disabled = s.role === "main" || !packsChanged || !s.plan;
  keep.title = s.role === "main" ? "Eine MAIN hat keine Pack-Vorauswahl — ihre Gründungstür nimmt keine Packs."
    : packsChanged ? "Die Pack-Auswahl dieser Session wird die Vorauswahl dieser Rolle, für alle künftigen Starts. Teile und Einstellungen bleiben bei dieser Session."
    : "Erst eine Pack-Auswahl ändern — dann kann sie die Vorauswahl dieser Rolle werden.";
  keep.onclick = saveAsProfile;
  const go = btn("fdgo");
  const label = s.busy ? (s.role === "main" ? "MAIN wird gegründet …" : s.packs.size ? "Packs werden zugestellt …" : "Startet …")
    : s.role === "main" ? "MAIN gründen" : s.mode === "old" ? "Fortsetzen" : s.mode === "new" ? "Lane starten" : "Starten";
  go.append(el("span", "", label));
  if (!s.busy) go.append(el("kbd", "", "⏎"));
  go.disabled = s.busy || blocker() !== null;
  go.title = s.place ? `${label}: ${tilde(s.place)} (Enter)` : label;
  go.onclick = () => { void start(); };
  const text = el("div", "fdsaycol");
  text.append(say, dev);
  if (why) text.append(note);
  const acts = el("div", "fdacts");
  acts.append(keep, go);
  foot.append(text, acts);
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
