// THE FOUNDING WINDOW — what a click on a free place in the bar opens (Neuentwurf 2026-09-29,
// Program Oberflaeche 0d51b4d4). The owner rejected the three-step comic page of 2026-09-22 as a
// whole („[Zitat entfernt]“); this is the replacement, not a repair of it.
//
// ONE PAGE, ONE SIZE. Every decision a founding takes is on screen at once, in the order you read
// it: WHO (the role tabs), WHERE (the list on the left, the chosen place in full on the right, what
// it hands the agent below it), HOW (the foot's option switches, the composer's own grammar, G4.3),
// and the one primary button. Nothing changes the window's size, nothing replaces the page — a
// state change repaints a part of it. The fast path is Enter: a role and a place are always
// preselected, so the window opened and Enter pressed is today's plain founding in the busiest repo.
//
// It is a src/shell.ts#openShell window (G6.3): the shell brings the dimmed backdrop, Esc/✕/click
// beside closing, the list's arrow keys and the mobile list→detail push. This module brings only
// what a founding is — and the ordinary rows of the shell stay ordinary: Enter on the selected
// place STARTS, the way Enter sends in the composer.
//
// "ANDERER ORDNER" STAYS IN THE WINDOW. The list turns into a folder browser over the existing
// /api/dirs route (one level at a time, a server search below it for two letters and more, the
// flat-hit rule of src/filetree.ts#matchTree), so a repo without a running session is chosen in
// the same place, with the same profile, as one with — never a jump into a second window.
//
// No server route or field is new: /api/dirs, /api/dirinfo, /api/founding-plan, the two /open doors
// and /api/lanes attach are what the founding used before, with the same bodies.
import {
  agentHarnesses, api, baseName, containerDefaults, defaultModel, el, fleet, fmtTs, harnesses,
  isMobile, laneBandNames, loadHarnesses, modelNotice, post, revealStartedSlot, setDrawer, SKEW_NOTE,
  stacksOf, startSession, startWorktree, type DirInfoResp, type HarnessInfo, type SlotInfo, type SpawnBody,
} from "./client";
import { matchTree } from "./filetree";
import { icon } from "./icons";
import { projectHue } from "./marks";
import { modelLabel } from "./modelname";
import { openShell, type Shell, type ShellRow } from "./shell";

type FoundRole = "plain" | "wt-new" | "wt-old" | "orch" | "steward";

// the roles as tabs (G3.1), plain first: it is today's founding and the preselection. `say` is the
// one sentence under the tabs — what this founding makes, in the owner's language (G0.5).
const ROLES: { id: FoundRole; name: string; say: string }[] = [
  { id: "plain", name: "Session", say: "Ein Agent in einem Ordner — ohne Rolle und ohne Lane." },
  { id: "wt-new", name: "Lane", say: "Eigener Worktree auf frischem Branch: arbeitet, beweist, wird gelandet." },
  { id: "wt-old", name: "Lane fortsetzen", say: "Setzt einen liegengebliebenen Worktree wieder auf diesen Slot — die Arbeit darauf bleibt." },
  { id: "orch", name: "Orchestrator", say: "Hält das Portfolio, schärft Aufträge und verteilt Arbeit — landet nicht selbst. Bekommt beim Start ihre Rollenkarte." },
  { id: "steward", name: "Steward", say: "Beobachtet die Fleet, meldet Stillstand und Widerspruch — nie eine zweite Owner-Stimme." },
];

// the label the server keys a role off: isOrchestratorLabel (word boundary) and STEWARD_LABEL
const roleLabel = (r: FoundRole): string | undefined =>
  r === "orch" ? "Orchestrator" : r === "steward" ? "⚙ steward" : undefined;
const isLane = (r: FoundRole): boolean => r === "wt-new" || r === "wt-old";

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

interface Repo { repo: string; name: string; slots: SlotInfo[] }
interface PlanPack { id: string; bytes: number; source: string; useWhen?: string }
interface Plan { selected: PlanPack[]; omitted: { id: string; reason: string }[] }
interface DirList { path: string; parent: string | null; dirs: string[]; repos?: string[]; capped?: boolean; total?: number }
interface FindHit { path: string; name: string; repo: boolean }
type Pop = "harness" | "model" | "effort" | "container";

interface State {
  shell: Shell;
  slot: number;
  role: FoundRole;
  view: "repos" | "folders";
  repos: Repo[];
  place: string | null;                 // the folder this founding would start in
  info: DirInfoResp | null; infoErr: string | null; infoSeq: number;
  plan: Plan | null; planErr: string | null; planFor: string | null; planSeq: number;
  packs: Set<string>;                   // switched-on pack ids — empty IS today's founding
  omitOpen: boolean;
  packOpen: Set<string>;
  orphan: string | null;                // the seatless worktree "Lane fortsetzen" seats
  harness: string | null; model: string; effort: string; container: string; containerContext: string;
  dir: string; list: DirList | null; listErr: string | null; listSeq: number;
  find: string; hits: FindHit[] | null; findPartial: boolean; findSeq: number;
  findTimer: ReturnType<typeof setTimeout> | null;
  error: string | null;                 // a refused founding, said next to the button
  busy: boolean;
  pop: Pop | null;
  restore: HTMLElement | null;
  teardown: () => void;
}
let S: State | null = null;

// every button in this window activates on its own Enter. The shell consumes Enter in the capture
// phase for the selected row (here: start); a focused tab, switch or option must keep its own.
function btn(cls: string, text?: string): HTMLButtonElement {
  const b = el("button", cls, text) as HTMLButtonElement;
  b.type = "button";
  b.dataset.ownEnter = "1";
  return b;
}
const tilde = (p: string): string => p.replace(/^\/Users\/[^/]+/, "~").replace(/^\/home\/[^/]+/, "~");
const kb = (n: number): string =>
  `${n >= 10000 ? String(Math.round(n / 1000)) : (n / 1000).toFixed(1).replace(".", ",")} KB`;

// the repos of the running fleet, busiest first, grouped by the canonical toplevel (SlotInfo.repo)
// so a MAIN in a subdir and its lanes land on one row. A repo with no session is not here — that is
// what the folder browser is for.
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

// what this founding sends. Absent fields are the door's defaults; `packs` only as an explicit
// choice, so with no switch on the body is byte-identical to a founding without packs.
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

// why the button cannot start right now — null when it can. Said next to the button, never only
// as a greyed-out control.
function blocker(): string | null {
  const s = S!;
  if (!s.place) return "Wähle, wo die Session laufen soll.";
  if (isLane(s.role)) {
    if (s.info && !s.info.git) return "Eine Lane braucht ein Git-Repo.";
    if (chosenHarness()?.allowsLanes === false) return `${chosenHarness()!.id} läuft nur als Haupt-Session, nicht als Lane.`;
  }
  if (s.role === "wt-old" && !s.orphan) return "Wähle den Worktree, der weiterlaufen soll.";
  if (s.packs.size) {
    if (s.planErr) return "Die gewählten Packs können nicht geprüft werden: " + s.planErr;
    if (!s.plan) return "Die gewählten Packs warten auf den Plan für diesen Start.";
    if (s.planFor !== planKey()) return "Der Plan der gewählten Packs gehört zu einem anderen Start.";
    if ([...s.packs].some((id) => !s.plan!.selected.some((p) => p.id === id)))
      return "Ein gewähltes Pack passt nicht mehr zu diesem Start. Wähle ohne Packs oder prüfe die Auswahl.";
  }
  return null;
}

// --- open / close --------------------------------------------------------------------------------

export function openPicker(slotId: number) {
  setDrawer(false);
  closeFounding();
  const restore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const shell = openShell({
    id: "found",
    title: "Neue Session",
    subtitle: `Slot ${slotId}`,
    listWidth: 300,
    // the keyboard moved the selection: the detail follows the cursor
    onSelect: (row) => { const p = row.el.dataset.path; if (p) choosePlace(p, false); },
    onClose: () => {
      const s = S;
      S = null;
      if (!s) return;
      s.teardown();
      if (s.findTimer) clearTimeout(s.findTimer);
      s.restore?.focus?.();
    },
  });
  shell.root.querySelector(".shellclose")?.replaceChildren(icon("x"));
  const repos = repoList();
  S = {
    shell, slot: slotId, role: "plain", view: repos.length ? "repos" : "folders", repos, place: null,
    info: null, infoErr: null, infoSeq: 0, plan: null, planErr: null, planFor: null, planSeq: 0,
    packs: new Set(), omitOpen: false, packOpen: new Set(), orphan: null,
    harness: null, model: "", effort: "", container: "", containerContext: "",
    dir: "~", list: null, listErr: null, listSeq: 0, find: "", hits: null, findPartial: false, findSeq: 0,
    findTimer: null, error: null, busy: false, pop: null, restore, teardown: () => {},
  };
  // the option popovers (G4.1) own Escape, the arrows and Enter while one is open. WINDOW capture
  // runs before the shell's document-capture handler, so an Escape here closes the popover and
  // never the window, and an arrow walks the popover's rows instead of the place list.
  const onKey = (e: KeyboardEvent) => {
    const s = S;
    if (!s?.pop) return;
    const pop = s.shell.foot.querySelector<HTMLElement>(".fdpop");
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closePop(true); return; }
    if (!pop || !(e.target instanceof Node) || !pop.contains(e.target)) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (e.target instanceof HTMLInputElement) return;
      e.preventDefault(); e.stopPropagation();
      const rows = [...pop.querySelectorAll<HTMLElement>(".fdprow")];
      const i = rows.indexOf(document.activeElement as HTMLElement);
      rows[e.key === "ArrowDown" ? Math.min(i + 1, rows.length - 1) : Math.max(i - 1, 0)]?.focus();
    } else if (e.key === "Enter") {
      // a button activates natively; the free-text field applies its value
      e.stopPropagation();
      if (e.target instanceof HTMLInputElement) { e.preventDefault(); e.target.dispatchEvent(new Event("change")); }
    }
  };
  const onDown = (e: PointerEvent) => {
    const s = S;
    if (!s?.pop || !(e.target instanceof Node)) return;
    const pop = s.shell.foot.querySelector(".fdpop");
    const sw = s.shell.foot.querySelector(`.fdopt[data-pop="${s.pop}"]`);
    if (pop?.contains(e.target) || sw?.contains(e.target)) return;
    closePop(false);
  };
  // the arrows' two other jobs in the folder browser: → opens the selected folder, ← goes up. Only
  // outside a text field with content, where they move the caret.
  const onNav = (e: KeyboardEvent) => {
    const s = S;
    // a modal keeps Tab inside itself: past the last control it wraps to the first, and back
    if (s && e.key === "Tab") {
      const all = [...s.shell.root.querySelectorAll<HTMLElement>("button:not(:disabled), input, [tabindex='0']")]
        .filter((x) => x.offsetParent !== null && x.tabIndex >= 0);
      const first = all[0], last = all[all.length - 1];
      if (first && last && e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (first && last && !e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      return;
    }
    if (!s || s.pop || s.view !== "folders" || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
    const t = e.target;
    if (t instanceof HTMLInputElement && t.value) return;
    if (t instanceof HTMLElement && t.closest(".fdtabs, .shellfoot")) return;
    e.preventDefault();
    if (e.key === "ArrowLeft") { if (s.list?.parent) enterDir(s.list.parent); return; }
    const row = s.shell.list.querySelector<HTMLElement>(".fdrow.sel");
    if (row?.dataset.path && !s.hits) enterDir(row.dataset.path);
  };
  window.addEventListener("keydown", onKey, true);
  shell.root.addEventListener("pointerdown", onDown, true);
  shell.root.addEventListener("keydown", onNav);
  S.teardown = () => {
    window.removeEventListener("keydown", onKey, true);
  };
  renderTools();
  renderFoot();
  if (repos.length) {
    renderList();
    choosePlace(repos[0]!.repo, false);
  } else {
    void loadDir("~");
  }
  // fetch-once: the catalogue is needed exactly when a founding is being composed
  void loadHarnesses().then(() => { if (S) { renderFoot(); renderDetail(); } });
  focusList();
}

export function closeFounding() {
  S?.shell.close();
}

function focusList() {
  if (!S || isMobile()) return;
  S.shell.list.focus({ preventScroll: true });
}

// --- the role tabs ---------------------------------------------------------------------------------

function renderTools() {
  const s = S;
  if (!s) return;
  const tabs = el("div", "fdtabs");
  tabs.setAttribute("role", "group");
  tabs.setAttribute("aria-label", "Rolle");
  for (const r of ROLES) {
    const on = r.id === s.role;
    const b = btn(`fdtab${on ? " on" : ""}`, r.name);
    b.setAttribute("aria-pressed", String(on));
    b.title = r.say;
    b.onclick = () => {
      if (s.role === r.id) return;
      s.role = r.id;
      s.error = null;
      if (r.id === "wt-old") s.packs.clear();
      s.packOpen.clear();
      s.orphan = null;
      renderTools();
      renderDetail();
      renderFoot();
    };
    tabs.append(b);
  }
  const say = el("div", "fdsay", ROLES.find((r) => r.id === s.role)!.say);
  s.shell.tools.replaceChildren(tabs, say);
}

// --- the list: repos of the fleet, or the folder browser ------------------------------------------

function placeRow(path: string, name: string, sub: string, right: string, hue: number | null, folder: boolean): HTMLElement {
  const row = el("div", "fdrow");
  row.dataset.path = path;
  if (hue !== null) {
    const dot = el("i", "fddot");
    dot.style.setProperty("--proj-h", String(hue));
    row.append(dot);
  } else if (folder) {
    const f = el("span", "fdfico");
    f.append(icon("folder"));
    row.append(f);
  }
  const main = el("div", "fdrmain");
  main.append(el("div", "fdrname", name));
  if (sub) main.append(el("div", "fdrsub", sub));
  row.append(main);
  if (right) row.append(el("span", "fdrright", right));
  row.onclick = () => { choosePlace(path, true); };
  return row;
}

function renderList() {
  const s = S;
  if (!s) return;
  const list = s.shell.list;
  list.tabIndex = 0;
  list.setAttribute("aria-label", "Ort der Session — Pfeiltasten wählen, Enter startet");
  list.replaceChildren();
  const rows: ShellRow[] = [];
  const open = () => { void start(); };
  if (s.view === "repos") {
    list.append(el("div", "fdsec", "Repos mit Sessions"));
    const names = barNames();
    for (const r of s.repos) {
      const who = r.slots.map((x) => barName(names, x));
      const right = who.length > 4 ? `${who.slice(0, 4).join(" ")} +${who.length - 4}` : who.join(" ");
      const row = placeRow(r.repo, r.name, tilde(r.repo), right, projectHue(r.repo), false);
      row.title = `${r.slots.length} Session${r.slots.length === 1 ? "" : "s"} in ${tilde(r.repo)}`;
      list.append(row);
      rows.push({ el: row, open });
    }
    const other = btn("fdother");
    other.append(icon("folder"), el("span", "", "Anderer Ordner …"));
    other.title = "Jeden Ordner auf diesem Rechner wählen — auch ein Repo ohne laufende Session.";
    other.onclick = () => { s.view = "folders"; void loadDir(s.dir); };
    list.append(other);
  } else {
    const nav = el("div", "fdnav");
    if (s.repos.length) {
      const back = btn("fdup", "‹ Repos");
      back.title = "Zurück zu den Repos mit laufenden Sessions.";
      back.onclick = () => { s.view = "repos"; s.find = ""; s.hits = null; renderList(); choosePlace(s.repos[0]!.repo, false); };
      nav.append(back);
    }
    const up = btn("fdup", "↑");
    up.title = "Eine Ebene höher (←).";
    up.disabled = !s.list?.parent;
    up.onclick = () => { if (s.list?.parent) enterDir(s.list.parent); };
    nav.append(up, el("span", "fdcwd", tilde(s.list?.path ?? s.dir)));
    const find = el("input", "fdfind") as HTMLInputElement;
    find.type = "text";
    find.placeholder = "Ordner suchen …";
    find.spellcheck = false;
    find.autocomplete = "off";
    find.value = s.find;
    find.oninput = () => { s.find = find.value; scheduleFind(); renderFolderRows(); };
    list.append(nav, find);
    const body = el("div", "fdfolders");
    list.append(body);
    renderFolderRows();
    return;
  }
  s.shell.setRows(rows);
  markSelected();
}

// the folder rows only — the nav and the search field above them stay, so typing keeps its focus
function renderFolderRows() {
  const s = S;
  if (!s) return;
  const body = s.shell.list.querySelector<HTMLElement>(".fdfolders");
  if (!body) return;
  body.replaceChildren();
  const rows: ShellRow[] = [];
  const open = () => { void start(); };
  const add = (path: string, name: string, sub: string, repo: boolean) => {
    const row = placeRow(path, name, sub, repo ? "git" : "", null, true);
    row.ondblclick = () => enterDir(path);
    const into = btn("fdinto");
    into.tabIndex = -1;
    into.append(icon("chevron"));
    into.title = "Ordner öffnen (→ oder Doppelklick)";
    into.onclick = (e) => { e.stopPropagation(); enterDir(path); };
    row.append(into);
    body.append(row);
    rows.push({ el: row, open });
  };
  if (s.listErr) body.append(el("div", "fdnote warn", s.listErr));
  else if (!s.list) body.append(el("div", "fdnote", "liest …"));
  else {
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
      if (!s.hits.length) body.append(el("div", "fdnote", "Kein Ordner mit diesem Namen hier drunter."));
      if (s.findPartial) body.append(el("div", "fdnote", "Die Suche hat nicht jeden Ordner gelesen — tiefer liegende Treffer können fehlen."));
    } else {
      const names = q ? matchTree(s.list.dirs, q) : s.list.dirs;
      for (const d of names) add(`${base}/${d}`.replace("//", "/"), d, "", repoSet.has(d));
      if (!names.length) body.append(el("div", "fdnote", q ? "Hier kein passender Ordner." : "Dieser Ordner hat keine Unterordner."));
      if (!q && s.list.capped) body.append(el("div", "fdnote", `${s.list.dirs.length} von ${s.list.total} Ordnern gezeigt — suche, um die übrigen zu finden.`));
    }
  }
  s.shell.setRows(rows);
  markSelected();
}

function markSelected() {
  const s = S;
  if (!s) return;
  const rows = [...s.shell.list.querySelectorAll<HTMLElement>(".fdrow")];
  const i = rows.findIndex((r) => r.dataset.path === s.place);
  if (i >= 0) s.shell.select(i, true, false);
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
  renderList();
  const res = await api(`/api/dirs?path=${encodeURIComponent(path)}`);
  if (S !== s || seq !== s.listSeq) return;
  const j = (await res.json().catch(() => null)) as (DirList & { error?: string }) | null;
  if (S !== s || seq !== s.listSeq) return;
  if (!res.ok || !j || !Array.isArray(j.dirs)) {
    s.listErr = j?.error ?? `Der Server antwortete ${res.status} für diesen Ordner.`;
  } else {
    s.list = j;
    s.dir = j.path;
  }
  renderList();
  // the folder you are IN is the first choice: Enter founds here, a row below narrows it
  if (s.list) choosePlace(s.list.path, false);
  s.shell.list.querySelector<HTMLInputElement>(".fdfind")?.focus({ preventScroll: true });
}

function enterDir(path: string) { void loadDir(path); }

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
    renderFolderRows();
  }, 220);
}

// --- the chosen place -----------------------------------------------------------------------------

function choosePlace(path: string, byClick: boolean) {
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
    s.orphan = null;
    s.omitOpen = false;
    s.packOpen.clear();
    s.error = null;
    void loadInfo();
  }
  markSelected();
  renderDetail();
  renderFoot();
  if (byClick && isMobile()) s.shell.showDetail(true);
}

async function loadInfo() {
  const s = S;
  if (!s?.place) return;
  const seq = ++s.infoSeq;
  const path = s.place;
  const res = await api(`/api/dirinfo?path=${encodeURIComponent(path)}`);
  if (S !== s || seq !== s.infoSeq || s.place !== path) return; // latest-wins
  if (res.status === 404) { s.infoErr = SKEW_NOTE; renderDetail(); return; }
  const info = (await res.json().catch(() => null)) as DirInfoResp | null;
  if (S !== s || seq !== s.infoSeq || s.place !== path) return;
  if (!res.ok || !info) { s.infoErr = info?.error ?? `Der Server antwortete ${res.status} für diesen Ordner.`; renderDetail(); return; }
  s.info = info;
  renderDetail();
  renderFoot();
}

// the plan hangs off (place, harness, mode); a change of any of the three reads it again
function planKey(): string {
  const s = S!;
  return `${s.place ?? ""}|${s.harness ?? harnesses.find((h) => h.default)?.id ?? ""}|${isLane(s.role) ? "lane" : "main"}|${s.role}|${s.model}`;
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
  s.packOpen.clear();
  const harness = s.harness ?? harnesses.find((h) => h.default)?.id ?? "";
  const mode = isLane(s.role) ? "lane" : "main";
  try {
    const res = await api(`/api/founding-plan?repo=${encodeURIComponent(path)}&harness=${encodeURIComponent(harness)}&mode=${mode}`);
    if (S !== s || seq !== s.planSeq || s.place !== path) return; // latest-wins
    if (key !== planKey()) return;
    if (res.status === 404) { s.planErr = SKEW_NOTE; renderDetail(); return; }
    const j: unknown = await res.json().catch(() => null);
    if (S !== s || seq !== s.planSeq || s.place !== path || key !== planKey()) return;
    if (!res.ok || !validPlan(j)) {
      s.planErr = `Der Plan für diesen Start ist nicht lesbar (Antwort ${res.status}).`;
    } else s.plan = j;
  } catch {
    if (S !== s || seq !== s.planSeq || key !== planKey()) return;
    s.planErr = "Der Plan für diesen Start konnte nicht geladen werden.";
  } finally {
    if (S === s && seq === s.planSeq) { renderDetail(); renderFoot(); }
  }
}

function validPlan(j: unknown): j is Plan {
  if (!j || typeof j !== "object" || !("selected" in j) || !("omitted" in j)) return false;
  return Array.isArray(j.selected) && Array.isArray(j.omitted)
    && j.selected.every((p: unknown) => !!p && typeof p === "object"
      && "id" in p && typeof p.id === "string" && "bytes" in p && typeof p.bytes === "number"
      && Number.isFinite(p.bytes) && p.bytes >= 0 && "source" in p
      && (p.source === "fleet-seed" || p.source === "repo-manifest")
      && (!("useWhen" in p) || p.useWhen === undefined || typeof p.useWhen === "string"))
    && j.omitted.every((p: unknown) => !!p && typeof p === "object"
      && "id" in p && typeof p.id === "string" && "reason" in p && typeof p.reason === "string");
}

function renderDetail() {
  const s = S;
  if (!s) return;
  const d = s.shell.detail;
  d.replaceChildren();
  if (!s.place) {
    d.append(el("div", "fdnote", "Wähle, wo die Session laufen soll."));
    return;
  }
  const head = el("div", "fdhead");
  head.append(el("div", "fdname", baseName(s.place) || s.place), el("div", "fdpath", tilde(s.place)));
  d.append(head);
  if (s.infoErr) { d.append(el("div", "fdnote warn", s.infoErr)); return; }
  const info = s.info;
  if (!info) { d.append(el("div", "fdnote", "liest …")); return; }

  // the state line: branch, the working tree, the upstream — each only where git answered
  if (info.git) {
    const facts = el("div", "fdfacts");
    facts.append(el("span", "mono", info.branch ?? "ohne Branch"));
    facts.append(info.dirty
      ? el("span", "warn", `${info.dirty} ungesichert`)
      : el("span", "ok", "sauber"));
    if (typeof info.ahead === "number" && typeof info.behind === "number")
      facts.append(el("span", "mono", `↑${info.ahead} ↓${info.behind}`));
    if (info.worktree) facts.append(el("span", "", "Worktree"));
    d.append(facts);
  } else {
    d.append(el("div", "fdnote", "Kein Git-Repo — hier startet eine Session, keine Lane."));
  }

  // who works here, by their names in the bar; model and effort only where the slot knows them
  const here = fleet.filter((x) => x.cwd && (x.repo ?? x.cwd) === s.place);
  if (here.length) {
    const sec = el("div", "fdsecd");
    sec.append(el("div", "fdh", "Hier arbeiten"));
    const names = barNames();
    for (const x of here.slice(0, 8)) {
      const row = el("div", "fdwho");
      const meta = [x.model ? modelLabel(x.model) : "", x.effort ?? ""].filter(Boolean).join(" · ");
      row.append(el("span", "fdbar", barName(names, x)), el("span", "fdlbl", x.label || baseName(x.cwd || "")),
        el("span", "fdmeta", meta));
      sec.append(row);
    }
    if (here.length > 8) sec.append(el("div", "fdnote", `und ${here.length - 8} weitere`));
    d.append(sec);
  }

  // "Lane fortsetzen": the repo's worktrees no slot holds, one to pick (G4.4)
  if (s.role === "wt-old" && info.git) {
    const sec = el("div", "fdsecd");
    sec.append(el("div", "fdh", "Liegengebliebene Worktrees"));
    const orphans = info.orphans ?? [];
    if (!orphans.length) sec.append(el("div", "fdnote", "Keine — jeder Worktree dieses Repos hat einen Slot."));
    for (const o of orphans) {
      const on = s.orphan === o.path;
      const b = btn(`fdpick${on ? " on" : ""}`);
      b.setAttribute("aria-pressed", String(on));
      b.append(el("span", "mono", baseName(o.path)), el("span", "fdmeta", o.branch || "ohne Branch"));
      b.title = `Diesen Worktree auf Slot ${s.slot} setzen.`;
      b.onclick = () => { s.orphan = on ? null : o.path; renderDetail(); renderFoot(); };
      sec.append(b);
    }
    d.append(sec);
  }

  // what the founding hands the agent: each deliverable pack a switch (default off), the rest
  // behind one fold with their reasons
  if (info.git) {
    if (s.planFor !== planKey()) void loadPlan();
    renderFoot();
    const sec = el("div", "fdsecd");
    sec.append(el("div", "fdh", "Mitgeben"));
    if (s.planErr) sec.append(el("div", "fdnote warn", s.planErr));
    else if (!s.plan) sec.append(el("div", "fdnote", "liest …"));
    else {
      const locked = s.role === "wt-old";
      for (const p of s.plan.selected) {
        const row = el("div", "fdpackrow");
        const b = btn("fdpack");
        b.setAttribute("role", "switch");
        b.disabled = locked;
        b.title = "Mitgeben — Klick schaltet, ob dieses Pack beim Start mitgeht.";
        b.append(el("span", "fdsw"), el("span", "fdpid", p.id), el("span", "fdpuse", p.useWhen ?? ""),
          el("span", "fdpkb", kb(p.bytes)));
        const detail = el("div", "fdpackdetail");
        detail.id = `fdpack-${s.plan.selected.indexOf(p)}`;
        const state = el("div", "fdpackstate");
        const sw = btn("fdpack fdpackchoice", "Mitgeben");
        sw.setAttribute("role", "switch");
        sw.disabled = locked;
        const update = () => {
          const on = s.packs.has(p.id);
          for (const control of [b, sw]) {
            control.classList.toggle("on", on);
            control.setAttribute("aria-checked", String(on));
          }
          detail.classList.toggle("preview", !on || locked);
          state.textContent = locked ? "Nicht mitgegeben: vorhandener Worktree"
            : on ? "Beim Start mitgegeben" : "Vorschau: würde beim Auswählen mitgegeben";
        };
        const toggle = () => {
          if (s.packs.has(p.id)) s.packs.delete(p.id); else s.packs.add(p.id);
          update();
          renderFoot();
        };
        b.onclick = toggle;
        sw.onclick = toggle;
        detail.append(state, el("div", "", `Zweck: ${p.useWhen ?? "im Plan nicht angegeben"}`),
          el("div", "", `Herkunft: ${p.source === "fleet-seed" ? "aus der Fleet" : "aus dem Repo"}`),
          el("div", "", `Größe: ${kb(p.bytes)}`), sw,
          el("div", "fdnote", "Verweise, Fassung und Hash stehen erst im Startbeleg nach dem Start."));
        update();
        const fold = packFold(p.id, detail);
        row.append(b, fold, detail);
        sec.append(row);
      }
      if (locked && s.plan.selected.length)
        sec.append(el("div", "fdnote", "Ein vorhandener Worktree bekommt keine Packs — sie gehen nur bei einer frischen Gründung mit."));
      if (!s.plan.selected.length && !s.plan.omitted.length)
        sec.append(el("div", "fdnote", "Dieses Repo erklärt keine Packs."));
      const om = s.plan.omitted;
      if (om.length) {
        const fold = btn(`fdfold${s.omitOpen ? " open" : ""}`);
        fold.setAttribute("aria-expanded", String(s.omitOpen));
        // "weitere" only next to switches; alone, the fold is the whole answer
        const n = s.plan.selected.length
          ? `${om.length} ${om.length === 1 ? "weiteres passt" : "weitere passen"}`
          : `${om.length} ${om.length === 1 ? "Pack passt" : "Packs passen"}`;
        fold.append(el("span", "", `${n} nicht zu diesem Start`), icon("chevron"));
        fold.onclick = () => { s.omitOpen = !s.omitOpen; renderDetail(); };
        sec.append(fold);
        if (s.omitOpen) for (const o of om) {
          const row = el("div", "fdomit");
          row.title = `intern: ${o.reason}`;
          row.append(el("span", "fdpid", o.id), el("span", "fdpuse", OMIT_SAY[o.reason] ?? o.reason));
          const detail = el("div", "fdpackdetail preview");
          detail.id = `fdomit-${om.indexOf(o)}`;
          detail.append(el("div", "fdpackstate", `Nicht mitgegeben: ${OMIT_SAY[o.reason] ?? o.reason}`),
            el("div", "", "Zweck, Herkunft und Größe: im Plan für ausgelassene Packs nicht angegeben."),
            el("div", "fdnote", "Verweise, Fassung und Hash stehen erst im Startbeleg nach dem Start."));
          row.append(packFold(o.id, detail), detail);
          sec.append(row);
        }
      }
    }
    d.append(sec);
  }

  if (info.recent?.length) {
    const sec = el("div", "fdsecd");
    sec.append(el("div", "fdh", "Zuletzt"));
    for (const c of info.recent.slice(0, 3)) {
      const row = el("div", "fdcommit");
      row.append(el("span", "mono", c.hash), el("span", "fdcs", c.subject), el("span", "fdmeta", fmtTs(c.ts)));
      sec.append(row);
    }
    d.append(sec);
  }
}

function packFold(id: string, detail: HTMLElement): HTMLButtonElement {
  const s = S!;
  const fold = btn("fdfold fdpackfold", "Details");
  fold.append(icon("chevron"));
  fold.setAttribute("aria-controls", detail.id);
  fold.setAttribute("aria-label", `Details zu ${id}`);
  const update = () => {
    const open = s.packOpen.has(id);
    fold.setAttribute("aria-expanded", String(open));
    fold.classList.toggle("open", open);
    detail.hidden = !open;
  };
  fold.onclick = () => {
    if (s.packOpen.has(id)) s.packOpen.delete(id); else s.packOpen.add(id);
    update();
  };
  update();
  return fold;
}

// --- the foot: how it runs, and the one button -------------------------------------------------

function closePop(refocus: boolean) {
  const s = S;
  if (!s?.pop) return;
  const which = s.pop;
  s.pop = null;
  renderFoot();
  if (refocus) s.shell.foot.querySelector<HTMLElement>(`.fdopt[data-pop="${which}"]`)?.focus();
}

function popRow(label: string, sub: string, on: boolean, pick: () => void): HTMLButtonElement {
  const r = btn(`fdprow${on ? " on" : ""}`);
  r.append(el("span", "", label));
  if (sub) r.append(el("span", "fdmeta", sub));
  r.onclick = () => { pick(); closePop(true); renderDetail(); };
  return r;
}

function optSwitch(which: Pop, value: string, dim: boolean, tip: string): HTMLElement {
  const s = S!;
  const wrap = el("div", "fdoptw");
  const b = btn(`fdopt${dim ? " dim" : ""}${s.pop === which ? " open" : ""}`);
  b.dataset.pop = which;
  b.setAttribute("aria-expanded", String(s.pop === which));
  b.title = tip;
  b.append(el("span", "", value), icon("chevron"));
  b.onclick = () => {
    s.pop = s.pop === which ? null : which;
    renderFoot();
    s.shell.foot.querySelector<HTMLElement>(".fdpop .fdprow.on, .fdpop .fdprow, .fdpop input")?.focus();
  };
  wrap.append(b);
  if (s.pop === which) wrap.append(popBody(which));
  return wrap;
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
      const notice = modelNotice(h.id, m);
      // two ids can share a display name (the 1M window is a property of the entry, not the id), so
      // the row carries the id itself under the name; "superseded" is said as the owner reads it
      const said = notice.replace(/^superseded/, "abgelöst");
      pop.append(popRow(modelLabel(m), said ? `${m} · ${said}` : m, s.model === m, () => { s.model = m; }));
    }
    const inWrap = el("label", "fdpin");
    inWrap.append(el("span", "", "Eigener Wert"));
    const inp = el("input", "") as HTMLInputElement;
    inp.type = "text";
    inp.spellcheck = false;
    inp.autocomplete = "off";
    inp.value = s.model;
    inp.placeholder = "genau so, wie der Adapter ihn liest";
    inp.onchange = () => { s.model = inp.value.trim(); closePop(true); renderDetail(); };
    inWrap.append(inp);
    pop.append(inWrap);
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
      inp.oninput = () => set(inp.value.trim());
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
// only (server.ts DEFAULT_MODEL); elsewhere the adapter decides, and the switch says who
function modelShown(h: HarnessInfo): string {
  if (h.default && defaultModel) return modelLabel(defaultModel);
  return "Adapter wählt";
}

function renderFoot() {
  const s = S;
  if (!s) return;
  const foot = s.shell.foot;
  foot.replaceChildren();
  const opts = el("div", "fdopts");
  const h = chosenHarness();
  if (agentHarnesses().length >= 2 && h)
    opts.append(optSwitch("harness", h.id, false, "Welcher Agent in dieser Session läuft."));
  if (h?.supports.model)
    opts.append(optSwitch("model", s.model ? modelLabel(s.model) : modelShown(h), !s.model,
      s.model ? `Modell ${s.model}` : "Modell — ohne Angabe startet der Adapter sein eigenes."));
  if (h?.supports.effort && h.effortLevels.length)
    opts.append(optSwitch("effort", s.effort ? `Effort ${s.effort}` : "Effort", !s.effort,
      "Wie gründlich der Agent denkt — ohne Angabe wählt der Adapter."));
  if (h?.supports.container)
    opts.append(optSwitch("container", s.container || "Container", !s.container,
      "Container und Docker-Daemon dieser Session — leer heißt der Fleet-Standard."));
  const why = s.error ?? blocker();
  const note = el("div", `fdfootnote${s.error ? " warn" : ""}`, why ?? "");
  const go = btn("fdgo");
  const label = s.busy ? "Packs werden zugestellt …"
    : s.role === "wt-new" ? "Start lane" : s.role === "wt-old" ? "Attach lane" : "Start session";
  go.append(el("span", "", label));
  if (!s.busy) go.append(el("kbd", "", "⏎"));
  go.disabled = s.busy || blocker() !== null;
  go.title = s.place ? `${label} in ${tilde(s.place)} auf Slot ${s.slot} (Enter)` : label;
  go.onclick = () => { void start(); };
  const body = foundingBody();
  const summary = el("div", "fdsummary");
  const field = (name: string, value: string) => {
    const part = el("span", "", `${name}: ${value}`);
    part.dataset.field = name;
    summary.append(part);
  };
  field("Rolle", roleLabel(s.role) ?? ROLES.find((r) => r.id === s.role)!.name);
  const place = s.place ? `${baseName(s.place)} (${tilde(s.place)})` : "noch nicht gewählt";
  const git = s.info?.git ? `${s.info.branch ?? "ohne Branch"}, ${s.info.dirty ? `${s.info.dirty} ungesichert` : "sauber"}`
    : s.infoErr ?? (s.info ? "kein Git-Repo" : "Ordner wird gelesen");
  field("Ort", `${place} · ${git}`);
  field("Agent", body.harness ?? `${h?.id ?? "Adapter wählt"} (Fleet-Standard)`);
  field("Modell", body.model ?? "Adapter wählt");
  field("Effort", body.effort ?? "Adapter wählt");
  field("Kontext", body.packs?.length ? `${body.packs.length} Packs: ${body.packs.join(", ")}`
    : !s.plan || s.planErr || s.planFor !== planKey() ? "Plan nicht lesbar, Start ohne Packs" : "kein Pack");
  if (body.container) field("Container", body.container);
  if (body.containerContext) field("Docker-Daemon", body.containerContext);
  field("Ausführungsrechte", "Fleet-Standard, hier nicht wählbar");
  const actions = el("div", "fdstartrow");
  actions.append(opts, note);
  if (s.packs.size && blocker()) {
    const clear = btn("fdfold", "Ohne Packs");
    clear.onclick = () => { s.packs.clear(); renderDetail(); renderFoot(); };
    actions.append(clear);
  }
  actions.append(go);
  foot.append(summary, actions);
}

// --- starting ----------------------------------------------------------------------------------------

async function start() {
  const s = S;
  if (!s || s.busy || blocker() !== null || !s.place) return;
  s.error = null;
  const onError = (msg: string) => { if (S === s) { s.error = msg; renderFoot(); } };
  // a founding WITH packs answers only after the door's boot grace plus readiness — the button
  // says so instead of sitting silent; packsDelivered:false comes back as s.error, never as success
  s.busy = true;
  renderFoot();
  try {
    const body = foundingBody();
    if (s.role === "wt-new") {
      await startWorktree(s.place, onError, { slot: s.slot, body });
    } else if (s.role === "wt-old") {
      // the clicked place: the lane is seated exactly here, or refused naming who sits there. An
      // attach never carries packs — the door refuses a packs list for a worktree it did not found.
      const { packs: _packs, ...attach } = body;
      const res = await post("/api/lanes", { repo: s.place, attach: s.orphan, slot: s.slot, ...attach });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        onError(err.error ?? `Der Server antwortete ${res.status}.`);
        return;
      }
      const j = (await res.json().catch(() => ({}))) as { slot?: number };
      const shown = j.slot ?? s.slot;
      if (!await revealStartedSlot(shown)) { onError(`Die Lane sitzt, aber Slot ${shown} erschien nicht binnen 5 Sekunden.`); return; }
      closeFounding();
    } else {
      await startSession(s.place, roleLabel(s.role), onError, { slot: s.slot, body });
    }
  } finally {
    if (S === s) { s.busy = false; renderFoot(); }
  }
}
