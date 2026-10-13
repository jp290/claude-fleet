import { $, el, MOBILE_MQ, TaskInfo, agentHarnesses, api, autosOnSrv, baseName, chip, copyText, defaultModel, describeEntity, dispatch, entityKnown, fleet, fmtDur, fmtTs, harnesses, labelled, loadHarnesses, post, quietHoursSrv, refresh, serverNow, setDrawer, showSlot, tasksList, toast } from "./client";
import { prefSet, prefText } from "./prefs";
import { perfRebuild } from "./perfmarks";
import { Shell, ShellRow, openShell } from "./shell";
import { askRisk } from "./dialog";
import { attachEntityCards } from "./entcard";
import { mdInto } from "./md";
import { laneTitleOf } from "./suitemeter";
import { noteFirstSentence } from "../task-notes";
import { ProjectedWaveTask, TaskWaveProjection, TaskWaveUnresolved, projectTaskWaves } from "../task-waves";
import type { KonzeptAnmerkung, KonzeptIndexRow, KonzeptVersion } from "../konzept-ledger";
import type { Principal } from "../server/auth";
import type { TraceRefs } from "../trace-index";
import { type BundleSuggestions, absorbedTaskIds, BundleProposal, LAND_WAVE_COSTS_2026_09, LAND_WAVE_ROWS_MAX, LandWave, LandWaveCosts, LandWaveProjection, projectLandWaves } from "../task-land-waves";

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
export const taskText = new Map<string, string>();
// the compiled brief — the exact bytes a lane will receive. Never on the poll (it is a whole
// prompt); the detail pane shows and edits it from here.
// `by` says WHO pinned an edited brief; ABSENT means it was pinned before authorship was recorded,
// and every site below reads that absence exactly as it read `edited` alone — which is what keeps
// every stored brief rendering byte-for-byte as it did (server/types.ts, BriefAuthor).
export interface FullBrief { text: string; at: number; model: string; edited: boolean; by?: "owner" | "main" }
// ONE reading of that pair for every surface, so the board and the Akte cannot drift into two
// answers about the same brief. Only an explicit "main" stamp says a machine authored it.
export const briefByMain = (b: { edited: boolean; by?: string } | undefined): boolean =>
  !!b && b.edited && b.by === "main";
export const taskBriefFull = new Map<string, FullBrief>();
// same reason for the criterion: the poll knows THAT one exists, this knows what it says
export const taskCriterionFull = new Map<string, NonNullable<TaskInfo["criterion"]>>();
// …and the comment thread. Same split for the same reason: a comment is free text of unbounded
// length, and the 2 s poll is the one place in this client where bytes are a standing cost.
// `from`/`verdict` are the LANE half of the thread (N2). Their absence is the owner's own remark,
// so the two populations are told apart by presence, never by a flag that could be forged.
export interface TaskCommentView { id: string; ts: number; text: string; from?: string;
  verdict?: "erledigt" | "widerlegt" | "offen" }
export const taskCommentsFull = new Map<string, TaskCommentView[]>();
// N3 · the two full lists. `taskNotesFull` is keyed by the AUFTRAG (which sources it names),
// `taskVerdictsFull` by the NOTIZ (which task-scoped reports stand on it) — the same two ends of
// the assignment the server keeps apart, kept apart here for the same reason.
export interface TaskNotePinView { noteId: string; at: number; by: "owner" | "main" }
export interface TaskNoteVerdictView { taskId: string; branch: string; verdict: string; text: string;
  at: number; landedAt?: number; landedSha?: string }
export const taskAbsorbedFull = new Map<string, string[]>();
export const taskDispositionFull = new Map<string, { beleg?: string }>();
export const taskNotesFull = new Map<string, TaskNotePinView[]>();
export const taskVerdictsFull = new Map<string, TaskNoteVerdictView[]>();
export let taskTextKey = ""; // the id+full-data-generation set this cache was last filled for
export let taskTextBusy = false;
export const taskTextWaiters: (() => void)[] = [];
// The poll's briefAt invalidates every browser. This local epoch still prevents a brief save in
// THIS browser from being overtaken by an older GET /api/tasks before the next poll arrives.
export let taskTextEpoch = 0;
export let qShell: Shell | null = null;
export let qPick: string | null = null;  // selected task id; null = the compose row
export let qQuery = "";
export type QView = "work" | "notes" | "programs" | "history" | "waves" | "konzepte";
export let qView: QView = "work";        // the operational list is primary; polls never reset the view
export let qProgDone = false;            // show `complete` programs in the Programs section (default off)
// renderQueue lives outside openQueue, where the view switch is built; the Work list's Notes
// pointer reaches the switch through this
export let qChooseView: ((next: QView) => void) | null = null;
export let qNotesOpen = false;           // the loose-notes group of Work begins folded; a search overrides it
// THE SCOPE (owner, 2026-09-18): repo → program → task. A program has no repo field, so it
// belongs to the repos its own tasks target; `null` = every repo / every program.
export let qRepo: string | null = null;
export let qProg: string | null = null;  // a program id, or Q_NO_PROGRAM for the rows that name none
export let qScopeBar: HTMLElement | null = null;
// L2 + L3 (owner, 2026-09-19: „[Zitat entfernt]“): the scope is a TREE column left of
// the list — all, then each repo, then the programs of the chosen one — or, switched, ONE picker
// "repo / program" in the toolbar line. Per-device pref; a phone always gets the line.
export let qTree: HTMLElement | null = null;
export let qTreeOn = prefText("fleet.queue.scope") !== "line";
export let qLayoutBtn: HTMLButtonElement | null = null;
export const qSel = new Set<string>();   // rows ticked for a bundle; cleared on open, on scope change and after an act
export let qBundleBusy = false;
// BUNDLE MODE (owner, 2026-09-18: „[Zitat entfernt]“, „[Zitat entfernt]“): one toolbar button
// switches the list from inspect to mark. While on, a click marks a row instead of opening it,
// the sensor's suggestions show with a one-click bundle, and the act bar sits at the list's foot.
export let qBundleMode = false;
export let qBundleBtn: HTMLButtonElement | null = null;
export let qKey = "";                    // the data key the list was last built from
export let qDetailKey = "";              // the data key the DETAIL pane was last built from (see refresh)
export let qCompose: HTMLTextAreaElement | null = null; // created ONCE per open — never re-created by a poll
export let qRepoIn: HTMLInputElement | null = null; // target-repo input, same once-per-open lifecycle
// the comment box, kept across rebuilds for the SELECTED task — same lifecycle trick as qCompose
// and for the same reason: a poll that repaints the detail must never eat half a typed sentence.
// Keyed by task id, because carrying one task's draft over to another row would be worse.
export let qCmBox: HTMLTextAreaElement | null = null;
export let qCmFor: string | null = null;
// Brief and criterion edits need the same poll-safe lifetime as comments. The server may deliver a
// newly compiled value while the untouched box is open, so each draft remembers both its seed and
// whether the owner has typed: fresh server text replaces an untouched seed, never local work.
export interface QTextDraft { for: string; box: HTMLTextAreaElement; seed: string; dirty: boolean }
export let qBriefDraft: QTextDraft | null = null;
export let qCriterionDraft: QTextDraft | null = null;
// the task whose RAW start the owner has ticked off (see the guard in renderQueueDetail). Kept
// across repaints — the 2 s poll rebuilds this pane — and keyed by ID, so an acknowledgment can
// never carry over to the row you look at next. Dropped when the window closes: it is a decision
// made in one sitting, not a setting.
export let qRawAck: string | null = null;

// --- TASK SPAWN CHOICE: the executable contract of the ▸ start / ▸ clarify acts. e2e/tasks.ts
// cuts this block out of the real source (between this marker and the closing one), transpiles it
// and runs it against fixtures — so the exact request bodies and the pre-start block are PROVEN,
// not read off a screenshot. Keep it free of DOM and of every other symbol in this file. ---
export type QSpawnPick = { harness: string; model: string; effort: string }; // "" = not chosen here
export type QSpawnRow = { harness: string | null; model: string | null; effort: string | null } | undefined;
export type QSpawnHarness = { id: string; default: boolean; role?: "agent" | "place";
  supports: { model: boolean; effort: boolean }; effortLevels: string[] };
export type QSpawnOrigin = "picked" | "row" | "default";
export type QSpawnField = { value: string | null; origin: QSpawnOrigin };
export type QSpawnEffective = { harness: QSpawnField; model: QSpawnField; effort: QSpawnField };
export const Q_SPAWN_EMPTY: QSpawnPick = { harness: "", model: "", effort: "" };
// Mirrors the server's per-field precedence at POST /api/tasks/:id/dispatch: an explicit body
// field wins, an absent one falls to the ROW's own persisted choice (Task.spawn), absence on both
// sides is the default adapter. `value: null` with origin "default" is that absence — the server's
// DEFAULT_SPAWN — and never a claim about which concrete model or level the adapter then runs.
export function qEffectiveSpawn(pick: QSpawnPick, row: QSpawnRow): QSpawnEffective {
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
export function qSpawnProblem(eff: QSpawnEffective, catalogue: QSpawnHarness[]): string | null {
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
export function qDispatchBody(act: "start" | "clarify", pick: QSpawnPick, rawAck: boolean): Record<string, unknown> {
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
export type QLifeStation = "pending" | "queued" | "sent" | "done";
export const Q_LIFE_STATIONS: readonly QLifeStation[] = ["pending", "queued", "sent", "done"];
// Where the row stands. Two ends are NOT stations on that rail and are said as themselves:
// `archived` (taken out of the rail) and `advisory` (a row that never assigns work at all). A
// status this build has never heard of is `unknown` — the poll is a foreign surface, and an
// unreadable status is not a pending row.
export type QLifeMark = QLifeStation | "archived" | "advisory" | "unknown";
// `reached` = how many stations of the rail are behind or at the current one, so the bar marks the
// past without a second rule. It is 0 for every mark that is not ON the rail — including
// `archived`, whose earlier walk the poll does not carry: absence of the history is not a claim
// that it never happened, so nothing is marked.
export interface QLifecycle { stations: readonly QLifeStation[]; current: QLifeMark; reached: number }
// The one act offered in the head. `none` is a state, not a missing field: a closed row and a
// `sent` row with no attachable lane both have nothing to offer, and each says why in its own
// words rather than showing an empty slot.
// `clarify` is a PLACEMENT key only since 2026-09-10: no head path produces it any more (see
// qMainActionOf). It stays in the union because place()/isMain()/mainCls() address the ▸ clarify
// first button by it, and an act nothing selects simply renders that button in the Actions row.
export type QMainAct = "adopt" | "clarify" | "release" | "start" | "open-lane" | "none";
export interface QMainSlot { act: QMainAct; label: string | null; why: string; slot: number | null }
// `hasCriterion` stood here until 2026-09-10: the head consulted it to decide between ▸ clarify
// first and release ▸, and only in combination with the retired analyst's `criterion` blocker.
// With the blocker gone the criterion's presence decides nothing in the head, so the field is not
// carried — a fact the head reads but never acts on is the shape this cut is removing.
export interface QHeadRow { status: string; kind?: string; slot?: number; repo?: string; programId?: string }
// the lane join, reduced to what the head needs: `lane` carries the slot its ▸ open lane names.
export interface QHeadLane { kind: "lane" | "refused" | "none"; slot?: number }
export interface QHeadPlan { status: string; program: string; repo: string; life: QLifecycle; main: QMainSlot }

// ADVISORY is every kind the dispatcher refuses, phrased as the negative — the same rule as
// qAdvisory below, restated here because this block must stay standalone; e2e/tasks.ts holds the
// two equal over the whole kind set, so a fifth kind cannot mean two different things.
export const qHeadAdvisory = (kind: string | undefined): boolean => kind !== undefined && kind !== "auftrag";
export const qShortRepo = (repo: string | undefined): string => {
  if (!repo) return "repo unknown";
  const parts = repo.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || "/";
};
// A bound program that the Program read cannot resolve is UNKNOWN, never "no program": the read
// fails, a row is discarded, an id outlives its program — and every one of those would otherwise
// render as the row belonging to nothing.
export const qHeadProgram = (programId: string | undefined, title: string | null): string =>
  !programId ? "no program" : title ?? "program unknown";
export function qLifecycleOf(status: string, kind: string | undefined): QLifecycle {
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
export function qMainActionOf(row: QHeadRow, lane: QHeadLane): QMainSlot {
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
export function qHeadPlan(row: QHeadRow, programTitle: string | null, lane: QHeadLane): QHeadPlan {
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
export const qSpawnPick = new Map<string, QSpawnPick>();
// the row's own persisted choice (Task.spawn), from GET /api/tasks like every other full field —
// the poll's digest does not carry it. Absent = the row never stored one (DEFAULT_SPAWN).
export const taskSpawnFull = new Map<string, NonNullable<QSpawnRow>>();
// THE CARD (card-extract.ts#TaskCard) as this client reads it off GET /api/tasks. Every field
// optional: it is a claim about a foreign surface, and an absent field is shown as absent.
export interface QCardView { ziel?: string; done?: string; verify?: string; verboten?: string[]; after?: string[];
  rolle?: { harness?: string | null; model?: string | null; effort?: string | null };
  valid?: boolean; gaps?: string[]; model?: string; at?: number }
export const taskCardFull = new Map<string, QCardView>();
// one kept node per task id, so a poll repaint re-syncs the pickers IN PLACE: an open dropdown or
// a half-typed model keeps its focus and caret (restoreFocus needs the focused node to survive).
export let qSpawnUi: { for: string; box: HTMLElement; sync: () => void } | null = null;
export const qSpawnStateOf = (id: string) => {
  const pick = qSpawnPick.get(id) ?? Q_SPAWN_EMPTY;
  const row = taskSpawnFull.get(id);
  const eff = qEffectiveSpawn(pick, row);
  return { pick, row, eff, problem: qSpawnProblem(eff, harnesses) };
};
// the spawn row of a startable task: the three pickers fed by the server's catalogue, the
// EFFECTIVE triple the start would run (each value with where it comes from), and the refusal
// the server would answer — shown before the click; the two acts stay disabled while it stands.
export function qSpawnRow(id: string): HTMLElement {
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
export let qRowId = new Map<HTMLElement, string | null>();

// The generation GET /api/tasks must match before the detail may make absence claims. The poll can
// announce a new top-level briefAt while the old full cache is still present; treating that cache
// as current would briefly call a stored brief absent.
export const qTaskFullKey = () => tasksList.map((t) =>
  `${t.id}:${t.status}:${t.briefAt ?? 0}:${t.criterion?.proposedAt ?? 0}:${t.criterion?.confirmedAt ?? 0}:${t.comments?.n ?? 0}:${t.comments?.at ?? 0}:${t.notes?.n ?? 0}:${t.notes?.at ?? 0}:${t.verdicts?.n ?? 0}:${t.verdicts?.at ?? 0}`
).join(",");
export const qTaskFullLoaded = (id: string) => taskText.has(id) && taskTextKey === qTaskFullKey();

// Prompt texts, cached by task id. They are not on the 2 s poll (server.ts TaskDigest) — this
// pulls them once per id-set, only while the window is actually open, and a task's text never
// changes after creation, so a cached entry stays valid until the id disappears.
export async function loadTaskTexts() {
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
        comments?: TaskCommentView[]; spawn?: NonNullable<QSpawnRow>; card?: QCardView;
        notes?: TaskNotePinView[]; verdicts?: TaskNoteVerdictView[]; absorbed?: string[]; disposition?: { beleg?: string } }[] };
      // A brief save can complete while this GET (started before it) is in flight. Never publish
      // that older response under the post-save generation; the retry below fetches the new truth.
      if (epoch === taskTextEpoch) {
        taskText.clear(); // the route returns every task, so this is the whole truth — no stale ids
        taskBriefFull.clear();
        taskCriterionFull.clear();
        taskCommentsFull.clear();
        taskNotesFull.clear();
        taskAbsorbedFull.clear();
        taskDispositionFull.clear();
        taskVerdictsFull.clear();
        taskSpawnFull.clear();
        taskCardFull.clear();
        for (const t of data.tasks) {
          if (t.card) taskCardFull.set(t.id, t.card);
          taskText.set(t.id, t.text);
          if (t.absorbed) taskAbsorbedFull.set(t.id, t.absorbed);
          if (t.disposition) taskDispositionFull.set(t.id, t.disposition);
          if (t.spawn) taskSpawnFull.set(t.id, t.spawn);
          if (t.brief) taskBriefFull.set(t.id, t.brief);
          if (t.criterion) taskCriterionFull.set(t.id, t.criterion);
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
  for (const resolve of taskTextWaiters.splice(0)) resolve();
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
export interface ProgramDigest { id: string; status: string; title: string; createdAt: number }
export type PublicProgramFoundingMode = "bootstrap" | "succession";
export interface PublicProgramFoundingOccupant { slot: number; openedAt: number }
export interface PublicProgramFoundingV1 {
  v: 1; attemptId: string; mode: PublicProgramFoundingMode; canonicalRoot: string;
  target: PublicProgramFoundingOccupant; predecessor: PublicProgramFoundingOccupant | null; startedAt: number;
}
export interface PublicProgramFoundingV2 {
  v: 2; profileKind: "standard" | "game-maker"; attemptId: string; mode: PublicProgramFoundingMode;
  targetRoot: string; target: PublicProgramFoundingOccupant;
  predecessor: PublicProgramFoundingOccupant | null; startedAt: number;
}
export type PublicProgramFounding = PublicProgramFoundingV1 | PublicProgramFoundingV2;
export type ProgramFoundingState = { state: "absent" }
  | { state: "pending"; record: PublicProgramFounding }
  | { state: "unreadable" };
export interface ProgramInfo extends ProgramDigest {
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
  dispatch?: { v?: number; on?: boolean; bypassMaster?: boolean; maxLanes?: number; confirmedAt?: number } | null;
  // THE OWNER'S RELEASE POLICY (server/types.ts#ProgramRelease) — same wire caution as above.
  release?: { v?: number; policy?: string; confirmedAt?: number } | null;
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

export const wireRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
export const exactWireKeys = (record: Record<string, unknown>, keys: string[]): boolean =>
  Object.keys(record).length === keys.length && Object.keys(record).every((key) => keys.includes(key));
export const publicFoundingOccupant = (value: unknown): PublicProgramFoundingOccupant | null => {
  const record = wireRecord(value);
  if (!record || !exactWireKeys(record, ["slot", "openedAt"])
    || !Number.isInteger(record.slot) || (record.slot as number) < 1
    || typeof record.openedAt !== "number" || !Number.isFinite(record.openedAt) || record.openedAt <= 0) return null;
  return { slot: record.slot as number, openedAt: record.openedAt };
};

// This is the GET /api/programs wire boundary. Undefined alone is absence; null, partial records,
// unknown keys and unknown versions are unreadable PRESENT facts and therefore fail closed.
export function programFoundingState(value: unknown): ProgramFoundingState {
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
export let programsPoll: ProgramDigest[] = [];   // the digest set the 2 s poll already carries
export let programsList: ProgramInfo[] = [];     // the full rows, from GET /api/programs
export let programsRead: "unread" | "ok" | "fail" = "unread";
export let programsAt = 0;
export let programsBusy = false;
// a forced refetch that arrives DURING a fetch (the bootstrap POST answers while the poll's own
// read is in flight) would otherwise be dropped, and a freshly founded MAIN would keep reading
// `unbound` until the floor elapsed. Exactly one is queued: more would only repeat the same read.
export let programsForceQueued = false;
export let programsDigestKey = "";
export const PROGRAMS_FLOOR_MS = 30_000;
export let programsStale = 0;             // fleet-wide count from the 2 s owner poll; absent means zero

export async function loadPrograms(force = false): Promise<void> {
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

export type ProgramMark = "live" | "stale" | "founding" | "unbound" | "unknown";
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
export function programMark(p: ProgramInfo): { mark: ProgramMark; why: string } {
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

export interface BootstrapUnavailable {
  availability: "unknown";
  recovery: "pending" | "rolled-back";
  affected: { attemptId: string; slot: number; openedAt: number };
}
export const bootstrapUnavailableFrom = (value: unknown): BootstrapUnavailable | null => {
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

export function bootstrapFailureMessage(status: number, value: unknown): string {
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
// "the owner never said„[Zitat entfernt]“the owner said
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
export type PromotionStateName = "absent" | "off" | "green-only" | "guarded" | "unreadable";
export const PROMOTION_RUNGS = ["off", "green-only", "guarded"];
export function promotionState(p: ProgramInfo): {
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
export type PromotionRequestStateName = "absent" | "off" | "green-only" | "guarded" | "unreadable";
export function promotionRequestState(p: ProgramInfo): {
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

// --- THE OWNER'S PROGRAM-SCOPED DISPATCH RECORD, read for display ---
// Since the server half of Sinnprüfung C8 (410e7029) the record answers TWO questions with two
// fields: `maxLanes` — how many of this program's lanes may run at once — and the start right,
// which the board shows as ONE three-way switch "darf starten":
//   an         = v2 {on:true,  bypassMaster:true}  (or v1 {on:true}): starts even with the Master off
//   wie Master = v2 {on:true,  bypassMaster:false} (or v1 {on:false}): follows the fleet switch
//   aus        = v2 {on:false}: never started by the tick, even with the Master on
// A v1 `on:false` is NOT "aus": the server reads v1 `on` as the old bypass only
// (server.ts#programDispatchStopped requires v2), so it follows the Master — and its maxLanes caps.
//
// FIVE states. `unreadable` for the reason promotionState has one: this row arrives over the wire,
// and a shape this build cannot read is NOT absence. Absence has a meaning — the Master and the
// machine's per-program number decide this program — so painting an unreadable record as absence
// would tell the owner that while something they cannot see sits on the row.
//
// READABILITY IS THE SERVER'S OWN RULE, restated (server/types.ts#loadProgramDispatch): v 1 or 2,
// `on` boolean, v2 also `bypassMaster` boolean, `maxLanes` a whole number in
// 1..PROGRAM_DISPATCH_MAX_LANES_MAX, confirmedAt a positive finite number.
//
// PURE AND TOP-LEVEL ON PURPOSE, like promotionState and profileState: no globals, no DOM, no
// clock, so a check can cut it out, transpile it and RUN it.
export type ProgramDispatchStateName = "absent" | "on" | "master" | "off" | "unreadable";
export type ProgramDispatchStart = "on" | "master" | "off";
export const PROGRAM_DISPATCH_MAX_LANES_UI = 16; // mirrors server/types.ts#PROGRAM_DISPATCH_MAX_LANES_MAX
export const PD_START_WORD: Record<ProgramDispatchStart, string> = { on: "an", master: "wie Master", off: "aus" };
export function programDispatchState(p: ProgramInfo): {
  state: ProgramDispatchStateName; label: string; tone: "ok" | "dim" | "warn";
  sentence: string; stamped: string | null;
  // what the two controls show as CURRENT; null = no readable record (absent/unreadable)
  start: ProgramDispatchStart | null; maxLanes: number | null;
} {
  const rec = p.dispatch as { v?: number; on?: boolean; bypassMaster?: boolean; maxLanes?: number; confirmedAt?: number } | null | undefined;
  if (rec === undefined || rec === null)
    return { state: "absent", label: "darf starten: wie Master · Standard", tone: "dim", stamped: null, start: null, maxLanes: null,
      sentence: "Nichts eingestellt: dieses Program folgt dem Master-Schalter der Fleet, und wie viele"
        + " seiner Lanes gleichzeitig laufen, bestimmt der Deckel der Maschine." };
  if (typeof rec !== "object" || Array.isArray(rec) || (rec.v !== 1 && rec.v !== 2)
    || typeof rec.on !== "boolean" || (rec.v === 2 && typeof rec.bypassMaster !== "boolean")
    || typeof rec.maxLanes !== "number" || !Number.isInteger(rec.maxLanes)
    || rec.maxLanes < 1 || rec.maxLanes > PROGRAM_DISPATCH_MAX_LANES_UI
    || typeof rec.confirmedAt !== "number" || !Number.isFinite(rec.confirmedAt) || rec.confirmedAt <= 0)
    return { state: "unreadable", label: "Program dispatch: unlesbar", tone: "warn", stamped: null, start: null, maxLanes: null,
      sentence: "Hier IST eine Einstellung gespeichert, aber in einer Form, die dieser Build nicht lesen"
        + " kann — also steht hier weder, was gilt, noch ein Datum. Der Server liest sie genauso nicht"
        + " und behandelt das Program wie ohne Einstellung; Apply unten überschreibt sie." };
  const stamped = fmtTs(rec.confirmedAt);
  const start: ProgramDispatchStart = rec.v === 1 ? (rec.on ? "on" : "master")
    : !rec.on ? "off" : rec.bypassMaster ? "on" : "master";
  const lanes = `${rec.maxLanes} Lane${rec.maxLanes === 1 ? "" : "s"}`;
  const label = `darf starten: ${PD_START_WORD[start]} · ${lanes}`;
  const cap = ` Höchstens ${lanes} dieses Programs laufen gleichzeitig; über dem Deckel der Maschine wirkt die Zahl nicht.`;
  if (start === "off")
    return { state: "off", label, tone: "warn", stamped, start, maxLanes: rec.maxLanes,
      sentence: "Aus: die Fleet startet keine Aufgabe dieses Programs von selbst, auch wenn der Master an"
        + " ist. Von Hand starten bleibt möglich." };
  if (start === "master")
    return { state: "master", label, tone: "dim", stamped, start, maxLanes: rec.maxLanes,
      sentence: "Wie Master: dieses Program startet, wenn der Master-Schalter der Fleet an ist, und"
        + ` wartet, wenn er aus ist.${cap}` };
  return { state: "on", label, tone: "ok", stamped, start, maxLanes: rec.maxLanes,
    sentence: "An: die Fleet startet freigegebene Aufgaben dieses Programs auch bei Master aus."
      + `${cap} Not-Aus für Automatik und Repo-Deckel halten weiter; die Ruhezeit gilt nur für`
      + " Aufgaben, die du selbst freigegeben hast." };
}

// --- THE OWNER'S RELEASE POLICY, read for display (server/types.ts#loadProgramRelease) ---
// Which pending rows the tick may start without a per-row release. ABSENT behaves exactly like
// `manual` and says nobody decided; an unreadable record loads as absent on the server too.
export type ProgramReleaseWord = "manual" | "card-valid" | "all";
export const PROGRAM_RELEASE_WORDS: ProgramReleaseWord[] = ["manual", "card-valid", "all"];
export function programReleaseState(p: ProgramInfo): {
  policy: ProgramReleaseWord | null; readable: boolean; stamped: string | null; sentence: string;
} {
  const rec = p.release;
  if (rec === undefined || rec === null)
    return { policy: null, readable: true, stamped: null,
      sentence: "Nichts eingestellt — wirkt wie manual: jede Aufgabe wartet auf deine Freigabe." };
  if (typeof rec !== "object" || rec.v !== 1 || !PROGRAM_RELEASE_WORDS.includes(rec.policy as ProgramReleaseWord)
    || typeof rec.confirmedAt !== "number" || !Number.isFinite(rec.confirmedAt) || rec.confirmedAt <= 0)
    return { policy: null, readable: false, stamped: null,
      sentence: "Hier ist eine Freigabe-Politik gespeichert, die dieser Build nicht lesen kann; der Server"
        + " behandelt sie wie manual. Apply unten überschreibt sie." };
  const policy = rec.policy as ProgramReleaseWord;
  return { policy, readable: true, stamped: fmtTs(rec.confirmedAt),
    sentence: policy === "manual" ? "manual: jede Aufgabe wartet auf deine Freigabe."
      : policy === "card-valid" ? "card-valid: Aufgaben mit gültiger Karte (DONE, VERIFY, Dateien im Baum),"
        + " vom Owner oder der MAIN gefilt, gelten ohne Einzelfreigabe als freigegeben."
      : "all: jede wartende Aufgabe dieses Programs gilt als freigegeben." };
}

// --- THE QUEUE FOOT: which gate holds the dispatcher right now ---
// Until 2026-09-28 the foot said "Dispatcher ON — runs released tasks" while the autos Not-Aus
// kept the tick silent (Sinnprüfung C8). It now names EVERY fleet-wide gate that holds, in the
// words of the settings window: Master aus, Not-Aus für Automatik (canDeliver's kill-switch),
// Ruhezeit (the server's own `quiet`, never this browser's clock), Repo-Deckel voll with its
// value. Per-program switches are not fleet-wide and stay in the Program detail. Pure: a check can
// cut it out and run it.
export function queueFootState(d: { on: boolean; maxLanes: number; repo: string; lanes?: number; quiet?: boolean },
  autosOn: boolean | null, quiet: { start: number; end: number } | null): { text: string; tip: string; gates: string[] } {
  const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
  const repo = baseName(d.repo);
  const gates: string[] = [];
  const tips: string[] = [];
  if (!d.on) { gates.push("Master aus"); tips.push("Master aus: freigegebene Aufgaben warten auf dich — außer in Programs mit „darf starten: an“."); }
  if (autosOn === false) { gates.push("Not-Aus für Automatik"); tips.push("Not-Aus für Automatik: keine geplanten Prompts und keine Lane-Starts, bis du die Automatik wieder einschaltest."); }
  if (d.quiet) {
    gates.push(quiet ? `Ruhezeit bis ${hh(quiet.end)}` : "Ruhezeit");
    tips.push("Ruhezeit: keine Lane-Starts bis zum Ende des Fensters (Uhr des Servers); Programs mit „darf starten: an“ starten nur, was die Fleet selbst freigegeben hat.");
  }
  if (typeof d.lanes === "number" && d.maxLanes > 0 && d.lanes >= d.maxLanes) {
    gates.push(`Repo-Deckel voll — ${d.lanes}/${d.maxLanes} Lanes in ${repo}`);
    tips.push("Repo-Deckel voll: erst wenn eine Lane landet oder schließt, startet die nächste.");
  }
  if (gates.length)
    return { gates, text: `Hält: ${gates.join(" · ")}. `, tip: `${tips.join(" ")} intern: tickDispatch, canDeliver` };
  return { gates, text: `Dispatcher an — startet freigegebene Aufgaben ohne dich, bis zu ${d.maxLanes} Lanes in ${repo}${typeof d.lanes === "number" ? ` (${d.lanes} ${d.lanes === 1 ? "läuft" : "laufen"})` : ""}. Eigene wählt er nie. `,
    tip: "Kein Tor der Fleet hält gerade; einzelne Programs können eigene Einstellungen haben (Program dispatch)." };
}
// the open foot's painter, called from renderQueue on every poll; null while the queue is closed
let qFootPaint: (() => void) | null = null;

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
export type ProfileAct = "game-maker" | "clear";
export type ProfileRequest = {
  path: string;
  body: { profile: { v: 1; kind: "game-maker" } | null };
};
export function profileRequestOf(programId: string, act: ProfileAct): ProfileRequest {
  return {
    path: `/api/programs/${programId}/profile`,
    body: act === "game-maker"
      ? { profile: { v: 1, kind: "game-maker" } }
      : { profile: null },
  };
}

export type ProfileStateName = "absent" | "game-maker" | "unreadable";
export const PROFILE_KINDS = ["game-maker"];
export function profileState(p: ProgramInfo): {
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
export type HealthIdentityName = "exact" | "divergent" | "unknown" | "unreadable";
export const HEALTH_MATCHES = ["exact", "divergent", "unknown"];
export function programHealthState(p: ProgramInfo, read: "unread" | "ok" | "fail"): {
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

export type ProgramStatusFact = { label: string; tone: "ok" | "dim" | "warn"; sentence: string };
export interface ProgramStatusRender {
  facts: ProgramStatusFact[];
  reason: string | null;
}

// The executable rendering model for D2's IN-MEMORY half. It accepts the Program row rather than
// loose counters so omitting `executionStatus` in a fixture takes the same path as an older server:
// one explicit unreadable sentence and no invented zeros. The ledger half cannot be read on this
// owner surface; renderProgramDetail names that boundary beside these facts.
export function programStatusRender(p: ProgramInfo, read: "unread" | "ok" | "fail"): ProgramStatusRender {
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
export let repoDatalistAt = 0;
export async function ensureRepoDatalist(): Promise<void> {
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
export let qBsFor: string | null = null;
export let qBsCwd: HTMLInputElement | null = null;
export let qBsLabel: HTMLInputElement | null = null;
export let qBsHarness: string | null = null;
export let qBsModel = "";
export let qBsEffort = "";
export let qBsErr: string | null = null;  // the server's own sentence, kept verbatim across repaints
export let qBsBusy = false;
// The founding POST is the one long await in this pane, and the owner can move on while it runs.
// Every answer therefore carries the generation it was sent under: a bumped generation (a new
// send, a changed selection, a reset draft, a closed overlay) makes an older answer touch NOTHING
// — not the error line, not the two inputs, not the busy flag of the request that replaced it.
// A p.id comparison alone would not do: A → B → A is back at the same id with a different draft.
export let qBsSeq = 0;
// The promote draft. It holds no typed text — only the in-flight half of a two-step the owner can
// walk away from mid-way, which is exactly why it carries the founding draft's generation guard.
export let qPlFor: string | null = null;
export let qPlErr: string | null = null;  // the server's own sentence, kept verbatim across repaints
export let qPlBusy = false;
// Same reason as qBsSeq: confirm→activate is two awaits, and a late answer must not write into a
// draft that has since been reset or moved to another program. Generation AND id — A → B → A is
// back at the same id with a different draft.
export let qPlSeq = 0;
// The promotion draft, and it is deliberately NOT the promote draft above. Both are owner acts on
// the same pane, but one advances a program's lifecycle and the other grants or takes back a
// PERMISSION — sharing a busy flag would disable a door the owner never touched, and sharing an
// error line would paint one act's refusal under the other's buttons. Same generation guard, same
// reason: the POST is an await the owner can walk away from, and A → B → A is back at the same id.
export let qPmFor: string | null = null;
export let qPmErr: string | null = null;  // the server's own sentence, kept verbatim across repaints
export let qPmBusy = false;
// WHICH act is in flight, not merely THAT one is. Four doors share one busy flag, so a bare flag
// would put "…" on all four and claim three sends nobody made.
export let qPmAct: string | null = null;
export let qPmSeq = 0;
// The execution-profile draft, and it is a THIRD independent one on the same pane for the reason
// the promotion draft is a second: these are three different owner acts (advance a lifecycle,
// grant a permission, choose an environment), and a shared busy flag or error line would put one
// act's refusal under another act's buttons.
export let qPrFor: string | null = null;
export let qPrErr: string | null = null;  // the server's own sentence, kept verbatim across repaints
export let qPrBusy = false;
export let qPrAct: string | null = null;
export let qPrSeq = 0;
// The program-dispatch draft, and it is a FOURTH independent one on the same pane for the reason
// the third is: granting the tick permission to START this program's rows is not advancing a
// lifecycle, not granting a land permission and not choosing an environment. A shared busy flag
// would disable a door the owner never touched; a shared error line would paint one act's refusal
// under another act's buttons.
export let qPdFor: string | null = null;
export let qPdErr: string | null = null;  // the server's own sentence, kept verbatim across repaints
export let qPdBusy = false;
export let qPdSeq = 0;
// the STAGED values of the section's three rows (G4.4: vorgemerkt until Apply); null = unchanged.
// Module state, not DOM state, so a poll repaint of the detail keeps what the owner picked.
export let qPdStart: ProgramDispatchStart | null = null;
export let qPdLanes: string | null = null;
export let qPdRelease: ProgramReleaseWord | null = null;

// the composer's program picker, same once-per-open lifecycle as qRepoIn
export let qProgSel: HTMLSelectElement | null = null;

// --- WHAT THE LIST IS ORDERED BY, and why it is no longer `status`.
//
// `pending` vs `queued` is a mechanism detail — it records whether the owner has clicked promote.
// Grouping by it made the queue answer a question nobody asks. The owner's real questions are
// „[Zitat entfernt]“, „[Zitat entfernt]“, „[Zitat entfernt]“, and everything else is backlog. So the
// group is DERIVED from status + criterion + kind, in that priority order, and each group is a
// standing answer. Nothing here is persisted: change the rule and every row re-sorts itself.
export type QGroup = "needs" | "released" | "running" | "backlog" | "notes";
// THE PIPELINE READS BOTTOM-UP (owner, 2026-09-18): a row enters at Backlog, climbs through
// Needs you and Released, and runs at the top. Advisory rows are not on that path at all, so they
// sit below it, folded, and a note ASSIGNED to a task leaves this group and rides under its task.
export const Q_GROUPS: { k: QGroup; head: string; hint: string }[] = [
  { k: "running", head: "Running", hint: "live in a lane" },
  { k: "released", head: "Released — runs next", hint: "you promoted these; the dispatcher takes them in this order, top first" },
  { k: "needs", head: "Needs you", hint: "waiting on a decision only you can make" },
  { k: "backlog", head: "Backlog", hint: "unreleased work orders — release one to move it up" },
  { k: "notes", head: "Notes & direction", hint: "advisory rows no task has assigned yet. Assign one to a task and it rides under that task; change its Kind to auftrag to make it work" },
];
// ADVISORY = every kind the dispatcher refuses, i.e. everything that is not an `auftrag`. Phrased
// as the negative on purpose: a kind added to the server later is advisory here until someone
// decides otherwise, which is the safe direction — the alternative would silently offer ▸ release
// on a row the server answers with 409.
export const qAdvisory = (t: TaskInfo): boolean => t.kind !== undefined && t.kind !== "auftrag";
export const qClosed = (t: TaskInfo): boolean => t.status === "done" || t.status === "archived";
export function qGroupOf(t: TaskInfo): QGroup | null {
  if (qClosed(t)) return null;
  if (t.status === "sent") return "running";
  // an observation is an observation whatever its status says. The check sits ABOVE `queued` on
  // purpose: releasing a note is refused today, but rows promoted before that refusal existed are
  // still in the state file, and showing one under "runs next" would be a promise nothing keeps.
  // It remains visible workbench input, in its own group below the pipeline.
  if (qAdvisory(t)) return "notes";
  if (t.status === "queued") return "released";
  // an unconfirmed criterion is a lane parked on YOUR answer
  if (t.criterion && t.criterion.confirmedAt === null) return "needs";
  return "backlog";
}
// The compact brief fact under a row's title. A queue-analyst verdict line stood here until
// 2026-09-10; what is left is the one thing that still decides WHICH BYTES a lane receives.
export function qVerdictLine(t: TaskInfo): string {
  if (qAdvisory(t)) return "";
  return t.briefAt ? "brief compiled" : "raw request";
}
export const qTaskText = (id: string) => taskText.get(id) ?? "";
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
export const QT_TAG = /^\[([^\]\n]{1,40})\]\s*/;
export const qFirstLine = (text: string) => {
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
export const qTag = (text: string) => QT_TAG.exec(text.split("\n")[0] ?? "")?.[1] ?? "";

// SEARCH IS A TASK JOIN, not a text-box convenience. Program title is not carried on a task
// digest, so the client must resolve the task's programId against the already-loaded Program read.
// Every searchable dimension stays in this pure block because e2e/tasks.ts executes it against
// identical task texts; deleting one field makes the corresponding SPEC probe fail.
export function qTaskMatches(t: TaskInfo, text: string,
  programs: readonly Pick<ProgramInfo, "id" | "title">[], query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const program = t.programId ? programs.find((candidate) => candidate.id === t.programId) : undefined;
  return [text, t.id, t.status, t.note ?? "", t.repo ?? "", t.programId ?? "", program?.title ?? ""]
    .some((field) => field.toLowerCase().includes(needle));
}

export interface QTaskListModel { work: TaskInfo[]; history: TaskInfo[]; showHistoryInWork: boolean }
export function qTaskListModel(tasks: TaskInfo[], texts: ReadonlyMap<string, string>,
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
// N3 · THE TWO ENDS OF AN ASSIGNMENT, as pure functions — DOM-free for the reason qTaskSummary and
// qTaskListModel are: e2e/tasks.ts executes them against the same rows the server would send, so
// completeness and ordering are checkable without opening a browser.
//
// ABSENCE IS RENDERED AS ITSELF in both. A pinned id no queue row answers is `known: false`, not a
// shorter list; a verdict naming a row that has been capped away keeps its `taskKnown: false`. The
// alternative — dropping either — makes "you were assigned fewer sources" indistinguishable from
// "one of them is unresolvable", and only the second is ever true.
export interface QNoteSourceRow { noteId: string; text: string; status: string; by: "owner" | "main"; known: boolean }
export function qNoteSourceRows(pins: readonly TaskNotePinView[], rows: readonly TaskInfo[],
  texts: ReadonlyMap<string, string>): QNoteSourceRow[] {
  return pins.map((pin) => {
    const row = rows.find((r) => r.id === pin.noteId);
    const text = texts.get(pin.noteId);
    return { noteId: pin.noteId, by: pin.by, known: !!row, status: row?.status ?? "unknown",
      text: !row ? "(nicht mehr auf der Queue)"
        : text ? noteFirstSentence(text, 160) : "(Text noch nicht geladen)" };
  });
}
export interface QNoteVerdictRow { taskId: string; branch: string; verdict: string; text: string; at: number;
  taskKnown: boolean; settled: boolean; landedSha?: string }
export function qNoteVerdictRows(verdicts: readonly TaskNoteVerdictView[],
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
export const qTouchedLine = (t: TaskInfo): string => {
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
export function taskSourceLabel(t: Pick<TaskInfo, "source">): string {
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
export function qVariantLine(t: TaskInfo, list: readonly TaskInfo[]): string {
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
// A ROW CHIP names one fact the owner scans for; the full sentence rides its title. Order is
// fixed so the eye finds the same fact in the same place on every row: state first (running /
// stopped / waiting), then what the row IS (program, size, kind), then what hangs off it.
export interface QChip { text: string; cls: string; title?: string }
export const Q_PROGRAM_CHIP_MAX = 26;
export function qProgramShort(title: string): string {
  const head = title.split(/\s+[—–-]\s+/)[0] ?? title;
  return head.length > Q_PROGRAM_CHIP_MAX ? `${head.slice(0, Q_PROGRAM_CHIP_MAX - 1)}…` : head;
}
// A ROW WITH A CARD is titled by its ZIEL (red team f8c69c56 §5 Nr. 3: 82 % of the open rows read
// "ROLLE: claude/…", the filers' first line), in the words its lane carries (suitemeter.ts#laneTitleOf).
// A CARD-SHAPED FIRST LINE ("[FLEET-BETRIEB · MITTEL · SUITE-ZEIT: …]") is the row's own title, but
// its program and size segments are exactly what the chips beside it already say. Drop those
// two, keep every other segment, and fall back to the sentence rule when the line is not one.
export const Q_SIZE_WORD = /^(klein|mittel|gro(ss|ß))$/i;
export function qRowTitle(text: string, programTitle: string | undefined, ziel?: string): string {
  const goal = ziel?.trim() ? laneTitleOf(ziel, null) : null;
  if (goal) return goal;
  const line = text.split("\n")[0] ?? "";
  const m = /^\[([^\]\n]{41,})\]/.exec(line);
  if (!m) return qFirstLine(text);
  const prog = programTitle ? qProgramShort(programTitle).toLowerCase() : null;
  const kept = m[1].split(/\s+·\s+/).filter((seg) => !Q_SIZE_WORD.test(seg.trim())
    && !(prog && seg.trim().length >= 4 && prog.startsWith(seg.trim().toLowerCase()))
    && !/^gefilet\b/i.test(seg.trim()));
  return kept.join(" · ") || qFirstLine(text);
}
export function qTaskSummary(t: TaskInfo, text: string, now: number,
  programs: readonly Pick<ProgramInfo, "id" | "title">[] = []): { title: string; chips: QChip[]; age: QChip } {
  const tag = qTag(text);
  const source = taskSourceLabel(t);
  const variant = qVariantLine(t, tasksList);
  const chips: QChip[] = [];
  if (t.modelSuperseded) chips.push({ text: `⚠ ${t.modelSuperseded.id}`, cls: "need",
    title: `superseded model${t.modelSuperseded.supersededBy ? ` → ${t.modelSuperseded.supersededBy}` : ""}` });
  if (t.status === "sent" && t.slot) chips.push({ text: `▶ slot ${t.slot}`, cls: "run" });
  if (t.hold) chips.push({ text: "⏸ held", cls: "hold",
    title: `stopped by the MAIN in slot ${t.hold.slot}: ${t.hold.grund ?? "(no reason given)"}` });
  if (t.criterion && t.criterion.confirmedAt === null)
    chips.push({ text: "? criterion", cls: "need", title: "a clarify lane proposed a done-criterion — confirm it" });
  const p = t.programId ? programs.find((x) => x.id === t.programId) : undefined;
  if (t.programId) {
    chips.push({ text: p ? qProgramShort(p.title) : t.programId.slice(0, 8), cls: "prog", title: p?.title ?? t.programId });
  }
  if (t.size) chips.push({ text: t.size, cls: `size size-${t.size}`, title: "card size" });
  // NACH: the rows this one waits for, from its card. Only the OPEN ones — a dependency that has
  // landed is no longer a wait — and the land fold never waves it ahead of them.
  const waits = (taskCardFull.get(t.id)?.after ?? []).filter((id) => {
    const dep = tasksList.find((x) => x.id === id);
    return !!dep && !qClosed(dep);
  });
  if (waits.length) chips.push({ text: `⤴ after ${waits.length}`, cls: "need", title: `waits for ${waits.join(", ")}` });
  if (qAdvisory(t)) chips.push({ text: t.kind ?? "advisory", cls: "kind" });
  else chips.push(t.briefAt ? { text: "brief", cls: "brief", title: "a compiled brief is what the lane receives" }
    : { text: "raw", cls: "raw", title: "no compiled brief — the lane receives the raw request" });
  if (variant) chips.push({ text: variant, cls: "var" });
  const touched = qTouchedLine(t);
  if (touched) chips.push({ text: `↯ ${t.touched?.length ?? 0}`, cls: "touch", title: touched });
  if (t.notes?.n) chips.push({ text: `📎 ${t.notes.n}`, cls: "att", title: `${t.notes.n} assigned note${t.notes.n === 1 ? "" : "s"}` });
  if (t.comments?.n) chips.push({ text: `💬 ${t.comments.n}`, cls: "att", title: `${t.comments.n} comment${t.comments.n === 1 ? "" : "s"}` });
  return {
    title: qRowTitle(text, p?.title, taskCardFull.get(t.id)?.ziel),
    chips,
    age: { text: fmtDur(Math.max(0, now - t.created)), cls: "age", title: `filed by ${tag ? `${source} / ${tag}` : source}` },
  };
}

// --- LANE ↔ TASK JOIN — which live lane belongs to which open task row, from the 2 s poll alone.
// The key is the dispatcher's own pointer: the dispatch core writes `task.slot = free.id` in the
// same tick as `slot.taskId = task.id`, and every teardown clears both (server.ts#detachSlotTasks,
// the boot reconciliation of `sent` rows). The task-side pointer selects the slot, and the guards
// below check the poll's slot facts to keep a stale pointer from painting a foreign lane on a row:
//   · status `sent` — the pointer means nothing on any other status (a detached row is `pending`)
//   · slot occupied AND a worktree — a recycled slot holding a plain checkout is not a lane
//   · openedAt ≥ task.created — a session opened before the row existed cannot be its lane
//   · repo — the row's target (or the dispatch default) against the lane's canonical toplevel. The
//     digest carries the path AS WRITTEN and the slot the RESOLVED one, so equality (or a
//     subdirectory of the toplevel) is a match, a segment-aligned suffix (/var/x vs /private/var/x)
//     is an ALIAS this client cannot resolve and says so, and anything else is FOREIGN — refused.
//   · program — a slot's programId must match the row's; a foreign program is refused. A slot
//     without programId stays UNCHECKED and says which fact is missing.
// Each slot attaches to at most one row: two `sent` rows naming one slot attach to neither, so a
// lane appears on the workbench zero or one times, never twice.
export interface QLaneSlot { id: number; cwd: string | null; openedAt?: number; lastOutput: number; programId?: string;
  git?: { dirty: number; ahead: number } | null; worktree?: { repo: string; branch: string } | null }
export interface QLaneTask { id: string; status: TaskInfo["status"]; created: number; slot?: number;
  repo?: string; programId?: string }
// `state` is the activity word; `dirty` rides beside it so "idle with uncommitted work" is said as
// both facts, not folded into one. done-looking is the GIT half of lane-signals' predicate (idle,
// clean, ahead>0) — alive, git-op and merge status are not on this poll and stay unchecked.
export type QLaneState = "running" | "idle" | "done-looking" | "unknown";
export interface QLaneFacts { state: QLaneState; quietMs: number | null; dirty: number | null; ahead: number | null }
export interface QLaneView extends QLaneFacts { slot: number; branch: string; repo: "match" | "alias";
  program: "match" | "unchecked" }
export type QLaneJoin = { kind: "lane"; lane: QLaneView } | { kind: "none" }
  | { kind: "refused"; slot: number; why: string };
// mirrors the server's FLEET_AUTO_REVIEW_IDLE_MS default — a claim about a foreign surface, which
// is why the line prints the quiet time itself and never only the word derived from it
export const Q_LANE_IDLE_MS = 60_000;
export function qLaneState(s: QLaneSlot, now: number): QLaneFacts {
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
export const qPathNorm = (p: string): string => p.replace(/\/+$/, "");
export function qRepoRelation(taskRepo: string | null, laneRepo: string): "match" | "alias" | "foreign" | "unknown" {
  if (!taskRepo) return "unknown";
  const a = qPathNorm(taskRepo);
  const b = qPathNorm(laneRepo);
  if (a === b || a.startsWith(`${b}/`)) return "match";
  // both are absolute, so a suffix match is segment-aligned by construction (/var/x ⊂ /private/var/x)
  if (a.endsWith(b) || b.endsWith(a)) return "alias";
  return "foreign";
}
export function qLaneJoins(tasks: readonly QLaneTask[], slots: readonly QLaneSlot[],
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
    if (s.programId && s.programId !== t.programId) {
      refuse(`the lane belongs to program ${s.programId}, foreign to this row's ${t.programId ? `program ${t.programId}` : "lack of a program"}`);
      continue;
    }
    out.set(t.id, { kind: "lane", lane: { slot, branch: s.worktree.branch, repo: rel,
      program: s.programId ? "match" : "unchecked", ...qLaneState(s, now) } });
  }
  return out;
}

export function qWaveProjection(): TaskWaveProjection {
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
export const Q_LAND_WAVE_COSTS: LandWaveCosts = LAND_WAVE_COSTS_2026_09;

// WHICH WAVE THE OWNER HAS ACKNOWLEDGED THE CAVEAT FOR, keyed by its id set. Per wave and not a
// single flag: the caveat is about THESE rows belonging together, so acknowledging one wave must
// never arm the button on the next. Cleared with the queue pane, like qRawAck beside it.
export let qWaveAck: string | null = null;
export const qWaveKey = (ids: readonly string[]): string => ids.join("+");

// The LANDE fold of the same facts: which rows could land TOGETHER (task-land-waves.ts), beside
// the parallel fold above. Read-only — there is no button here and no dispatch reads it.
export function qLandWaveProjection(): LandWaveProjection {
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
export function qLandWaveStart(line: HTMLElement, wave: LandWave): void {
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

export async function qStartWave(wave: LandWave): Promise<void> {
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

// --- BÜNDEL (owner, 2026-09-18): aggregate rows by click, with a trail and a way back.
// A bundle is an ordinary auftrag whose text carries its sources WHOLE, and whose second line
// names them. Each source is archived with the reason "gebündelt in <id>". The trail therefore
// lives in two places that do not depend on each other: the bundle's own immutable text, and the
// sources' dispositions. ⧉ auflösen restores every source (unarchive, which also reaches rows
// the cap already evicted to tasks-archive.jsonl) and archives the bundle.
export const Q_BUNDLE_LINE = /^⧉ gebündelt aus: ([a-z0-9]+(?:, [a-z0-9]+)*)$/m;
export const Q_BUNDLE_TITLE_MAX = 60;
export const Q_BUNDLE_RELEASED = /^⧉ freigegeben waren: ([a-z0-9]+(?:, [a-z0-9]+)*)$/m;
export const qBundleSources = (text: string): string[] => Q_BUNDLE_LINE.exec(text)?.[1].split(", ") ?? [];
// the sources that were RELEASED when bundled: auflösen re-releases exactly these, because
// unarchive restores every row as pending and a release must never be lost silently
export const qBundleReleased = (text: string): string[] => Q_BUNDLE_RELEASED.exec(text)?.[1].split(", ") ?? [];
// why a row cannot enter a bundle, or null when it can
export function qBundleRefusal(t: TaskInfo): string | null {
  if (qAdvisory(t)) return "only an auftrag can be bundled — assign a note to a task instead";
  if (t.status !== "pending" && t.status !== "queued") return `a ${t.status} row cannot be bundled`;
  if (t.hold) return "held by its MAIN — a bundle would start it around that stop";
  if (t.variants || t.variantOf) return "variant rows are decided as a group, not bundled";
  return null;
}
export function qBundleDraft(ids: readonly string[]):
  { text: string; repo: string | null; programId: string | null; queue: boolean } | string {
  const rows = ids.map((id) => tasksList.find((t) => t.id === id));
  if (rows.some((t) => !t)) return "a ticked row is gone — reload";
  const ts = rows as TaskInfo[];
  for (const t of ts) { const why = qBundleRefusal(t); if (why) return `${t.id}: ${why}`; }
  const repos = new Set(ts.map(qTaskRepo));
  if (repos.size > 1) return "the rows target different repos — a lane works in one";
  const progs = new Set(ts.map((t) => t.programId ?? null));
  if (progs.size > 1) return "the rows belong to different programs — move them into one first";
  if (ts.some((t) => !taskText.has(t.id))) return "task texts are still loading — try again in a moment";
  const progTitle = programsList.find((p) => p.id === [...progs][0])?.title;
  const titles = ts.map((t) => qRowTitle(qTaskText(t.id), progTitle, taskCardFull.get(t.id)?.ziel).replace(/[[\]]/g, "").slice(0, Q_BUNDLE_TITLE_MAX));
  const released = ts.filter((t) => t.status === "queued").map((t) => t.id);
  const text = [
    `[BÜNDEL · ${titles.slice(0, 2).join(" + ")}${ts.length > 2 ? ` (+${ts.length - 2})` : ""}]`,
    `⧉ gebündelt aus: ${ts.map((t) => t.id).join(", ")}`,
    ...(released.length ? [`⧉ freigegeben waren: ${released.join(", ")}`] : []),
    "Ein Auftrag aus mehreren Zeilen: jede Quelle unten ist ein Teil davon, jeder Teil braucht sein eigenes DONE.",
    ...ts.map((t) => `\n── ${t.id} ──\n${qTaskText(t.id)}`),
  ].join("\n");
  if (text.length > Q_TASK_TEXT_MAX) return `the bundle would be ${text.length} characters — the server keeps ${Q_TASK_TEXT_MAX}`;
  // released only when EVERY source was: a bundle must not release a row the owner had not
  return { text, repo: [...repos][0] ?? null, programId: [...progs][0] ?? null, queue: released.length === ts.length };
}
export const Q_TASK_TEXT_MAX = 20_000; // mirrors server.ts#MAX_TASK_TEXT, which would silently cut the tail
export async function qMakeBundle(ids: readonly string[]): Promise<void> {
  if (qBundleBusy) return;
  const draft = qBundleDraft(ids);
  if (typeof draft === "string") { toast(draft); return; }
  qBundleBusy = true;
  try {
    const r = await post("/api/tasks", { text: draft.text, ...(draft.repo ? { repo: draft.repo } : {}),
      ...(draft.programId ? { programId: draft.programId } : {}), ...(draft.queue ? { queue: true } : {}) });
    const j = (await r.json().catch(() => null)) as { task?: { id: string }; error?: string } | null;
    if (!r.ok || !j?.task) { toast(j?.error ?? "couldn't create the bundle"); return; }
    const id = j.task.id;
    const failed: string[] = [];
    for (const src of ids) {
      const a = await post(`/api/tasks/${src}/archive`, { grund: `gebündelt in ${id}`, beleg: id });
      if (!a.ok) failed.push(src);
    }
    if (failed.length) toast(`bundle ${id} made, but ${failed.join(", ")} stayed open — archive by hand or ⧉ auflösen`);
    qSel.clear();
    qBundleMode = false; // done: the new bundle opens in the pane, clicks open rows again
    qPick = id;
    taskTextKey = "";
  } finally {
    qBundleBusy = false;
  }
  await refresh();
  qKey = ""; qDetailKey = "";
  renderQueue(); renderQueueDetail();
}
export async function qDissolveBundle(t: TaskInfo): Promise<void> {
  if (qBundleBusy) return;
  const sources = qBundleSources(qTaskText(t.id));
  if (!sources.length || t.status === "sent") return;
  qBundleBusy = true;
  const failed: string[] = [];
  try {
    const released = new Set(qBundleReleased(qTaskText(t.id)));
    const unreleased: string[] = [];
    for (const src of sources) {
      const r = await post(`/api/tasks/${src}/unarchive`, {});
      if (!r.ok) { failed.push(src); continue; }
      if (released.has(src) && !(await post(`/api/tasks/${src}/queue`, {})).ok) unreleased.push(src);
    }
    if (unreleased.length) toast(`${unreleased.join(", ")} restored but not re-released — release by hand`);
    if (failed.length) toast(`${failed.join(", ")} could not be restored — the bundle stays`);
    else await post(`/api/tasks/${t.id}/archive`, { grund: "Bündel aufgelöst", beleg: sources.join(", ") });
    taskTextKey = "";
  } finally {
    qBundleBusy = false;
  }
  await refresh();
  qKey = ""; qDetailKey = "";
  renderQueue(); renderQueueDetail();
}

export function qWaveProjectionKey(): string {
  return JSON.stringify([
    dispatch.repo, dispatch.maxLanes,
    tasksList.map((t) =>
      [t.id, t.repo, t.kind, t.status, t.created, t.files, t.filesOrigin, t.programId]),
  ]);
}

export type QWaveLocation =
  | { kind: "wave"; item: ProjectedWaveTask; repo: string; wave: number }
  | { kind: "unresolved"; item: TaskWaveUnresolved };
export function qWaveLocation(id: string, projection: TaskWaveProjection): QWaveLocation | null {
  for (const repo of projection.repos) for (const wave of repo.waves) {
    const item = wave.tasks.find((task) => task.id === id);
    if (item) return { kind: "wave", item, repo: repo.repo, wave: wave.index };
  }
  const unresolved = projection.unresolved.find((task) => task.id === id);
  return unresolved ? { kind: "unresolved", item: unresolved } : null;
}

// --- SUGGESTED BUNDLES (Waves, read-only): the machine's own proposal, GET /api/start-plan → buendel
// (task-land-waves.ts#proposeBundles, Schnitt 3 of docs/messungen/2026-09-21-dispatch-flaechen-buendeln.md).
// The section SHOWS it and does nothing else: no button, no write — whether two rows share a lane
// stays the owner's call, made through ⧉ Bundle in Work. Read when Waves opens and again when the
// 2 s poll moves a task fact the proposal reads; no timer of its own. A failed read says so and
// never draws as "none".
export let qBundlesRead: "unread" | "ok" | "fail" = "unread";
export let qBundles: BundleProposal[] = [];
export let qBundlesKey = "";
export let qBundlesBusy = false;
export const qBundlesTaskKey = () => JSON.stringify([qWaveProjectionKey(),
  tasksList.map((t) => [t.size, t.briefAt, t.variantOf, t.variants?.length])]);
export async function loadBundles(force = false): Promise<void> {
  const key = qBundlesTaskKey();
  if (qBundlesBusy || (!force && key === qBundlesKey)) return;
  qBundlesBusy = true;
  const before = JSON.stringify([qBundlesRead, qBundles]);
  try {
    const res = await api("/api/start-plan");
    if (res.ok) {
      const data = (await res.json()) as { buendel?: BundleSuggestions };
      if (Array.isArray(data.buendel?.pairs)) { qBundles = data.buendel.pairs; qBundlesRead = "ok"; } else qBundlesRead = "fail";
    } else qBundlesRead = "fail";
  } catch {
    qBundlesRead = "fail";
  }
  qBundlesKey = key;
  qBundlesBusy = false;
  if (JSON.stringify([qBundlesRead, qBundles]) !== before && qView === "waves") { qKey = ""; renderQueue(); }
}
export function qRenderBundles(parent: HTMLElement, addSection: (name: string, count: number, hint: string) => void): void {
  addSection("Suggested bundles", qBundlesRead === "ok" ? qBundles.length : 0,
    "Vorschlag der Maschine: zwei offene Zeilen desselben Programs mit gemeinsamer Datei-Flaeche,"
    + " zusammen hoechstens mittel und mit denselben VERIFY-Stufen koennten eine Lane teilen."
    + " Nur Anzeige — zusammenlegen geht ueber ⧉ Bundle in Work.");
  if (qBundlesRead !== "ok") {
    parent.appendChild(el("div", "hint qwavehint", qBundlesRead === "fail"
      ? "bundles unknown — der Vorschlag konnte nicht gelesen werden"
      : "bundles unknown — wird gelesen"));
    return;
  }
  if (!qBundles.length) { parent.appendChild(el("div", "hint qwavehint", "no bundle suggested")); return; }
  for (const b of qBundles) {
    const line = el("div", "qsuggest qbundlesug");
    b.ids.forEach((id, i) => {
      const ids = el("div", "qsuggestt");
      if (i) ids.append("+ ");
      const span = el("span", "ent ent-task", id);
      span.dataset.ent = "task";
      span.dataset.id = id;
      span.tabIndex = 0;
      span.setAttribute("role", "link");
      span.onclick = () => qSelect(id);
      span.onkeydown = (e) => { if (e.key === "Enter") qSelect(id); };
      ids.appendChild(span);
      ids.append(` ${qFirstLine(qTaskText(id)).slice(0, 60)}`);
      line.appendChild(ids);
    });
    line.appendChild(el("div", "qsuggestf", b.grund));
    line.appendChild(el("div", "qsuggestf", `${b.units} unit${b.units === 1 ? "" : "s"}`));
    parent.appendChild(line);
  }
}
// --- end SUGGESTED BUNDLES

export function qTextDraft(current: QTextDraft | null, id: string, seed: string, rows: number): QTextDraft {
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
export async function qAct(id: string, action: string, body: Record<string, unknown> = {}): Promise<boolean> {
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

// A BLOCK OF TEXT THE OWNER MAY WANT TO TAKE WITH HIM (Stilvorgabe 2026-09-19, the chat view's
// code block): a header that NAMES the text and offers to copy it, then the text itself. The
// confirmation is the one green the Vorgabe allows, and it says "copied" rather than turning into
// an icon — the label is the receipt. Nothing here is markdown: the queue's texts are briefs and
// requests, and mdcopy.ts (which would copy them AS markdown) lives on the unlanded chat lane.
// a rail act as a list item: its label, and under it the one line that says what it does
export function qActDesc(node: HTMLElement, desc: string): HTMLElement {
  node.classList.add("qact");
  node.appendChild(el("span", "qactdesc", desc));
  return node;
}

// HOVERABLE IDS in the queue (owner, 2026-09-19: „[Zitat entfernt]“
// ): the chat view's card (src/entcard.ts)
// and its entityKnown/describeEntity, one copy for both surfaces.

// wrap every 8-hex task id the board knows, inside `root`'s TEXT, in the span entcard reads. Only
// text nodes: a draft in a textarea is never touched, and a span already marked is skipped. The
// title's own id is left alone — hovering the row you are reading tells you nothing.
export const Q_ID_RE = /\b[0-9a-f]{8}\b/g;
export function qMarkIds(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const p = n.parentElement;
      if (!p || p.closest(".ent, .qdtitle-id, textarea, button")) return NodeFilter.FILTER_REJECT;
      return /[0-9a-f]{8}/.test(n.nodeValue ?? "") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const hits: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) hits.push(n as Text);
  for (const node of hits) {
    const text = node.nodeValue ?? "";
    const frag = document.createDocumentFragment();
    let last = 0;
    let marked = false;
    for (const m of text.matchAll(Q_ID_RE)) {
      if (!entityKnown("task", m[0])) continue;
      const at = m.index ?? 0;
      frag.append(text.slice(last, at));
      const span = el("span", "ent ent-task", m[0]);
      span.dataset.ent = "task";
      span.dataset.id = m[0];
      span.tabIndex = 0;
      frag.appendChild(span);
      last = at + m[0].length;
      marked = true;
    }
    if (!marked) continue;
    frag.append(text.slice(last));
    node.replaceWith(frag);
  }
}

// the row whose original request the owner opened from the „[Zitat entfernt]“ strip
export let qShowOriginal: string | null = null;

export function qTextBlock(parent: HTMLElement, label: string, text: string): HTMLElement {
  const box = el("div", "qdblock");
  const head = el("div", "qdblockh");
  head.appendChild(el("span", "qdblockl", label));
  const copy = el("button", "qdblockc", "copy") as HTMLButtonElement;
  copy.type = "button";
  copy.title = `copy ${label} to the clipboard`;
  copy.onclick = () => {
    copyText(text);
    copy.textContent = "copied";
    copy.classList.add("ok");
    // the receipt is short-lived on purpose: a button that stays "copied" stops saying whether
    // THIS click landed. 1.2 s is the chat view's own confirmation window.
    setTimeout(() => { copy.textContent = "copy"; copy.classList.remove("ok"); }, 1200);
  };
  head.appendChild(copy);
  // the text RENDERED (owner, 2026-09-19: „[Zitat entfernt]“): headings, lists,
  // code and quotes through the chat's own markdown renderer; the copy button still takes the raw
  // bytes, which are what a lane gets
  const body = el("div", "qdtext qdmd");
  mdInto(body, text);
  box.append(head, body);
  parent.appendChild(box);
  return box;
}

export function qDetailSection(parent: HTMLElement, title: string, disclosure = false, open = true): HTMLElement {
  const section = document.createElement(disclosure ? "details" : "section");
  section.className = "qdsection";
  if (section instanceof HTMLDetailsElement) section.open = open;
  section.appendChild(el(disclosure ? "summary" : "div", "qdsection-title", title));
  const body = el("div", "qdsection-body");
  section.appendChild(body);
  parent.appendChild(section);
  return body;
}

// THE ONE COMMENT THREAD (Program Konzeptgedaechtnis 31aa88ea, Karte 2): the Task.comments rail,
// generalized to a TARGET instead of copied — a task row, or a konzept at its current version. The
// thread paints each entry as the task thread always did (the text block with its copy button, then
// one line of who/what/when and the entry's one act) and ends in the compose box. What differs per
// target is handed in, never branched on here: the entries' lines, the act, and where `send` posts.
export type CommentTarget = { kind: "task"; id: string } | { kind: "konzept"; id: string; version: number };
export const commentTargetKey = (t: CommentTarget): string =>
  t.kind === "task" ? `task:${t.id}` : `konzept:${t.id}@v${t.version}`;
export interface CommentEntry {
  id: string; ts: number; text: string; label: string;
  // painted left to right before the timestamp: a string is a hint line, a node goes in as it is
  lines: (string | HTMLElement)[];
  // `ask` = the act needs a reason: the click opens a one-line box under the entry instead of acting
  act?: { text: string; title: string; ask?: string; run: (reason: string) => void };
}
export interface CommentCompose { placeholder: string; button: string; title: string;
  send: (text: string) => Promise<boolean> }
// the reason box of an act that asks one, kept across repaints like the compose box — keyed by
// target and entry, so a half-typed Grund never lands on another entry
let qCmAsk: { key: string; box: HTMLInputElement } | null = null;
export function commentThread(parent: HTMLElement, target: CommentTarget, title: string,
  entries: readonly CommentEntry[], compose: CommentCompose | null): void {
  const tkey = commentTargetKey(target);
  parent.appendChild(el("div", "rvhead", entries.length ? `${title} · ${entries.length}` : title));
  for (const c of entries) {
    qTextBlock(parent, c.label, c.text);
    const cline = el("div", "pkdacts");
    for (const l of c.lines) cline.appendChild(typeof l === "string" ? el("div", "hint shellhint", l) : l);
    cline.appendChild(el("div", "hint shellhint", fmtTs(c.ts)));
    const act = c.act;
    const askKey = `${tkey}#${c.id}`;
    if (act) {
      const cx = el("button", "shrbtn", act.text) as HTMLButtonElement;
      cx.title = act.title;
      cx.onclick = () => {
        if (act.ask === undefined) { act.run(""); return; }
        if (qCmAsk?.key === askKey) qCmAsk = null;
        else {
          const box = el("input", "qaddin") as HTMLInputElement;
          box.type = "text";
          box.placeholder = act.ask;
          qCmAsk = { key: askKey, box };
        }
        qDetailKey = ""; renderQueueDetail();
        qCmAsk?.box.focus();
      };
      cline.appendChild(cx);
    }
    parent.appendChild(cline);
    if (act?.ask !== undefined && qCmAsk?.key === askKey) {
      const ask = qCmAsk;
      const row = el("div", "pkdacts");
      const go = el("button", "shrbtn", act.text) as HTMLButtonElement;
      go.title = act.title;
      go.onclick = () => {
        const reason = ask.box.value.trim();
        if (!reason) { ask.box.focus(); return; }
        act.run(reason);
      };
      ask.box.onkeydown = (e) => { if (e.key === "Enter") go.click(); };
      row.append(ask.box, go);
      parent.appendChild(row);
    }
  }
  if (!compose) return;
  // the box itself is kept across rebuilds (see qCmBox): the 2 s poll repaints this pane whenever
  // a verdict or a comment lands, and a locally-created textarea would lose a half-typed remark
  if (!qCmBox || qCmFor !== tkey) {
    qCmBox = el("textarea", "qdcrit") as HTMLTextAreaElement;
    qCmBox.rows = 3;
    qCmBox.placeholder = compose.placeholder;
    qCmFor = tkey;
  }
  const cbox = qCmBox;
  parent.appendChild(cbox);
  const cmacts = el("div", "pkdacts");
  const cmb = el("button", "shrbtn", compose.button) as HTMLButtonElement;
  cmb.title = compose.title;
  cmb.onclick = () => {
    if (!cbox.value.trim()) return;
    // cleared only once the server has it — a draft dropped on a failed post is gone for good
    void compose.send(cbox.value).then((ok) => { if (ok) cbox.value = ""; });
  };
  cmacts.appendChild(cmb);
  parent.appendChild(cmacts);
}
// THE KONZEPTE VIEW (Program Konzeptgedaechtnis 31aa88ea, Karte 2): each konzept under the private
// root, its current version's METADATA and the anmerkungen of this and earlier versions as a thread.
// The fassung itself (v<N>.md) is never fetched or drawn — the index and the two ledger reads carry
// no content, so this view cannot leak it. Owner-only reads (GET /api/konzepte, /api/konzepte/:id/…).
export let konzepteIndex: KonzeptIndexRow[] = [];
export let konzepteRead: "unread" | "ok" | "fail" = "unread";
let konzepteErr: string | null = null;
let konzepteKey = "";
let konzepteAt = 0;
let konzepteBusy = false;
// the detail's two reads per konzept — see renderKonzeptDetail for when they are dropped
const konzeptFull = new Map<string, { versionen: KonzeptVersion[]; anmerkungen: KonzeptAnmerkung[] } | { error: string }>();
const KONZEPTE_FLOOR_MS = 15_000; // the list is not on the poll; a view open for minutes re-reads at most this often
export async function loadKonzepte(force = false): Promise<void> {
  if (konzepteBusy || (!force && Date.now() - konzepteAt < KONZEPTE_FLOOR_MS)) return;
  konzepteBusy = true;
  try {
    const r = await api("/api/konzepte").catch(() => null);
    const j = r ? (await r.json().catch(() => null)) as { konzepte?: KonzeptIndexRow[]; error?: string } | null : null;
    if (r?.ok && Array.isArray(j?.konzepte)) { konzepteIndex = j.konzepte; konzepteRead = "ok"; konzepteErr = null; }
    else {
      konzepteRead = "fail";
      konzepteErr = r ? `GET /api/konzepte answered ${r.status}${j?.error ? ` — ${j.error}` : ""}` : "GET /api/konzepte: no answer";
    }
  } finally { konzepteBusy = false; konzepteAt = Date.now(); }
  const key = JSON.stringify([konzepteRead, konzepteErr, konzepteIndex]);
  if (key !== konzepteKey) { konzepteKey = key; qKey = ""; renderQueue(); }
}

// WHO wrote it, from the Principal as the ledger recorded it — never re-derived here
export function konzeptWho(a: Principal | { kind: string } | null | undefined): string {
  if (!a) return "unbekannt";
  const p = a as Principal;
  switch (p.kind) {
    case "owner": return "Owner";
    case "session": return `Session · Slot ${p.slot} · ${p.role}`;
    case "device": return `Geraet ${p.deviceId.slice(0, 8)}`;
    case "guest": return `Gast ${p.shareId}`;
    case "machine": return `Maschine · ${p.why}`;
    default: return a.kind;
  }
}

// THE KONTEXT as links: a task opens its row, a program its pane — both as hoverable ids (entcard)
// when the board knows them, plain text when it does not (an archived row is still its id)
function konzeptKontext(k: TraceRefs | undefined): HTMLElement | null {
  if (!k) return null;
  const parts: (string | HTMLElement)[] = [];
  const link = (kind: "task" | "program", id: string, go: () => void): HTMLElement => {
    if (!entityKnown(kind, id)) return el("span", "", id);
    const span = el("span", `ent ent-${kind}`, kind === "program" ? id.slice(0, 8) : id);
    span.dataset.ent = kind;
    span.dataset.id = id;
    span.tabIndex = 0;
    span.style.cursor = "pointer";
    span.onclick = go;
    return span;
  };
  if (k.task) {
    const id = k.task;
    parts.push("Task ", link("task", id, () => {
      const t = tasksList.find((x) => x.id === id);
      qChooseView?.(t && qClosed(t) ? "history" : "work");
      qSelect(id);
    }));
  }
  if (k.program) {
    const id = k.program;
    if (parts.length) parts.push(" · ");
    parts.push("Program ", link("program", id, () => { qChooseView?.("programs"); qSelect(`prog:${id}`); }));
  }
  if (typeof k.slot === "number") parts.push(`${parts.length ? " · " : ""}Slot ${k.slot}`);
  if (k.branch) parts.push(`${parts.length ? " · " : ""}${k.branch}`);
  if (!parts.length) return null;
  const line = el("div", "hint shellhint", "Kontext: ");
  line.append(...parts);
  return line;
}

function konzeptStatus(s: KonzeptAnmerkung["status"]): HTMLElement {
  if (s === "offen") return el("span", "qchip qc-need", "offen");
  if ("eingearbeitet" in s) return el("span", "qchip qc-run", `eingearbeitet in v${s.eingearbeitet}`);
  const v = el("span", "qchip qc-kind", `verworfen · ${konzeptWho(s.actor)}`);
  v.title = `Grund: ${s.verworfen}`;
  return v;
}

async function konzeptPost(id: string, rest: string, body: Record<string, unknown>): Promise<boolean> {
  const r = await post(`/api/konzepte/${encodeURIComponent(id)}/${rest}`, body);
  if (!r.ok) {
    const j = (await r.json().catch(() => null)) as { error?: string } | null;
    toast(j?.error ?? `POST /api/konzepte/${id}/${rest} answered ${r.status}`);
    return false;
  }
  qCmAsk = null;
  konzeptFull.delete(id);
  await loadKonzepte(true);
  qKey = ""; qDetailKey = "";
  renderQueue();
  renderQueueDetail();
  return true;
}

export function renderKonzeptDetail(shell: Shell, id: string): void {
  const row = konzepteIndex.find((k) => k.konzept === id);
  const titleBox = el("div", "qdtitle");
  titleBox.appendChild(el("div", "qdtitle-t", id));
  const chips = el("div", "qchips");
  if (row?.letzte) {
    chips.appendChild(el("span", "qchip qc-kind", `v${row.letzte.version}`));
    chips.appendChild(el("span", "qchip qc-prog", row.letzte.ebene));
  }
  chips.appendChild(el("span", "qdtitle-id", id));
  titleBox.appendChild(chips);
  shell.detail.appendChild(titleBox);
  const body = el("div", "");
  shell.detail.appendChild(body);
  // ON DEMAND like the repo sheet: the poll does not repaint this pane (client.ts, the konz: branch).
  // The two reads are cached per konzept so a repaint (the reason box, a failed post) draws at once
  // and keeps its focus; a write, "neu lesen" and reopening the view drop the cache.
  const full = konzeptFull.get(id);
  if (!full) {
    body.appendChild(el("div", "hint shellhint", "lese die Versionen und Anmerkungen dieses Konzepts …"));
    const enc = encodeURIComponent(id);
    void Promise.all([api(`/api/konzepte/${enc}/versionen`).catch(() => null),
      api(`/api/konzepte/${enc}/anmerkungen`).catch(() => null)]).then(async ([rv, ra]) => {
      const jv = rv ? (await rv.json().catch(() => null)) as { versionen?: KonzeptVersion[]; error?: string } | null : null;
      const ja = ra ? (await ra.json().catch(() => null)) as { anmerkungen?: KonzeptAnmerkung[]; error?: string } | null : null;
      if (rv?.ok && ra?.ok && Array.isArray(jv?.versionen) && Array.isArray(ja?.anmerkungen))
        konzeptFull.set(id, { versionen: jv.versionen, anmerkungen: ja.anmerkungen });
      else {
        const bad = !rv?.ok ? rv : ra;
        const err = (!rv?.ok ? jv : ja)?.error;
        konzeptFull.set(id, { error: bad ? `GET /api/konzepte/${id}/… answered ${bad.status}${err ? ` — ${err}` : ""}`
          : "keine Antwort — Versionen und Anmerkungen dieses Konzepts sind gerade unbekannt" });
      }
      if (qPick === `konz:${id}` && body.isConnected) { qDetailKey = ""; renderQueueDetail(); }
    });
    return;
  }
  if ("error" in full) {
    body.appendChild(el("div", "pkdwarn", full.error));
    const retry = el("button", "shrbtn", "↻ neu lesen") as HTMLButtonElement;
    retry.onclick = () => { konzeptFull.delete(id); qDetailKey = ""; renderQueueDetail(); };
    body.appendChild(retry);
    return;
  }
  const versionen = [...full.versionen].sort((a, b) => b.version - a.version);
  const cur = versionen[0];
  const again = el("button", "shrbtn", "↻ neu lesen") as HTMLButtonElement;
  again.type = "button";
  again.title = "die beiden Ledger dieses Konzepts neu lesen — der Poll haelt diese Ansicht nicht frisch";
  again.onclick = () => { konzeptFull.delete(id); void loadKonzepte(true); qDetailKey = ""; renderQueueDetail(); };
  const top = el("div", "pkdacts");
  top.appendChild(again);
  body.appendChild(top);
  if (!cur) {
    body.appendChild(el("div", "hint shellhint",
      "noch keine Version — eine Anmerkung haengt an einer veroeffentlichten Version, darum gibt es hier noch nichts zu schreiben"));
    return;
  }
  const head = qDetailSection(body, "Aktuelle Version");
  head.appendChild(el("div", "qdtext", `v${cur.version} · ${fmtTs(cur.at)} · ${konzeptWho(cur.actor)}`));
  const kx = konzeptKontext(cur.kontext);
  if (kx) head.appendChild(kx);
  qTextBlock(head, "Anlass", cur.anlass);
  const facts = el("div", "hint shellhint", `Ebene ${cur.ebene} · gilt: ${cur.geltung}`
    + (cur.arbeitetEin.length ? ` · arbeitet ${cur.arbeitetEin.length} Anmerkung${cur.arbeitetEin.length === 1 ? "" : "en"} ein` : "")
    + ` · sha256 ${cur.sha256.slice(0, 12)}…`);
  facts.title = `sha256 ${cur.sha256}`;
  head.appendChild(facts);

  // the thread: this version's anmerkungen and every earlier one, oldest first like a conversation
  const thread = el("div", "");
  body.appendChild(thread);
  const anm = [...full.anmerkungen].sort((a, b) => a.at - b.at);
  commentThread(thread, { kind: "konzept", id, version: cur.version }, "Anmerkungen", anm.map((a) => {
    const lines: (string | HTMLElement)[] = [el("span", "qchip qc-kind", `v${a.version}`)];
    if (a.anker) lines.push(`§ ${a.anker.abschnitt}`);
    lines.push(konzeptStatus(a.status));
    const kc = konzeptKontext(a.kontext);
    if (kc) lines.push(kc);
    if (typeof a.status === "object" && "verworfen" in a.status) lines.push(`Grund: ${a.status.verworfen}`);
    return { id: a.id, ts: a.at, text: a.text, label: konzeptWho(a.actor), lines,
      act: typeof a.status === "object" && "verworfen" in a.status ? undefined : {
        text: "✕ verwerfen", title: "diese Anmerkung verwerfen — der Grund steht danach im Ledger, mit dir als actor",
        ask: "Grund — warum diese Anmerkung nicht eingearbeitet wird",
        run: (grund: string) => void konzeptPost(id, `anmerkungen/${a.id}/verwerfen`, { grund }),
      } };
  }), {
    placeholder: `Anmerkung zu ${id} v${cur.version}…`, button: `💬 an v${cur.version} anmerken`,
    title: `haengt an Version ${cur.version} — dein Principal (Owner) wird serverseitig als actor gesetzt`,
    send: (text) => konzeptPost(id, "anmerkungen", { version: cur.version, text }),
  });

  if (versionen.length > 1) {
    const older = qDetailSection(body, `Fruehere Versionen · ${versionen.length - 1}`, true, false);
    for (const v of versionen.slice(1)) {
      older.appendChild(el("div", "qdtext", `v${v.version} · ${fmtTs(v.at)} · ${konzeptWho(v.actor)} — ${v.anlass}`));
      const vk = konzeptKontext(v.kontext);
      if (vk) older.appendChild(vk);
    }
  }
}

// One program, in the SAME list/detail pane the tasks use. What it must make impossible is the
// state this surface was built for: a program whose MAIN died months ago reading like a running
// one. So the mark, its derivation sentence, and the founding flow all sit on one pane.
export function renderProgramDetail(shell: Shell, id: string): void {
  const p = programsList.find((x) => x.id === id);
  if (!p) {
    shell.detail.appendChild(el("div", "hint shellhint", programsRead === "fail"
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
  shell.detail.appendChild(el("div", "hint shellhint", why));
  // the sentence itself, not only as a tooltip, exactly where it costs something: a closed return
  // path and an unreadable one are the two states an owner must not scroll past.
  if (budgetNote && (!room || room.free === 0))
    shell.detail.appendChild(el("div", "hint shellhint", budgetNote));
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
  status.appendChild(el("div", "hint shellhint",
    "This owner list carries D2's in-memory projection only. lastLand, lastAudit and the per-repo"
    + " deploy cells exist only on the bound MAIN's self projection, so this board cannot"
    + " attribute or render them."));

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
    pr.appendChild(el("div", "hint shellhint", prSt.sentence));
    pr.appendChild(el("div", "hint shellhint",
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
    pm.appendChild(el("div", "hint shellhint", st.sentence));
    pm.appendChild(el("div", "hint shellhint",
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
  // section answers "how many of this program's lanes, may the tick start them at all, and which
  // rows count as released" — three rows, ONE NUMBER PER QUESTION (Sinnprüfung C8): until 2026-09-28
  // the cap and the start right were one button ("grant · 2 lanes") and the release policy had no
  // board surface. Two routes behind it: /dispatch for the first two rows, /release for the third.
  // It sits ABOVE the stale/unknown early return for the promotion door's
  // reason: a program whose MAIN died is exactly a program whose standing grant an owner may want
  // to take back, and that return would hide the only door that can.
  {
    if (qPdFor !== p.id) {
      qPdFor = p.id;
      qPdSeq++; // a DIFFERENT program; anything still in flight for the old one is orphaned
      qPdErr = null; qPdBusy = false;
      qPdStart = null; qPdLanes = null; qPdRelease = null;
    }
    const forPdId = p.id;
    const pdSt = programDispatchState(p);
    const rlSt = programReleaseState(p);
    // THE BODIES, WRITTEN OUT from the three staged values and nothing else — the server reads a
    // CLOSED set, so the dispatch body is exactly {v:2, on, bypassMaster, maxLanes} and the release
    // body exactly {v:1, policy}. A row the owner did not touch keeps the stored value; an empty
    // lane field sends 16, the server's own ceiling, which the Math.min in
    // server.ts#programDispatchCap turns into the machine's number — "Standard" for this row.
    const START_BODY: Record<ProgramDispatchStart, { on: boolean; bypassMaster: boolean }> = {
      on: { on: true, bypassMaster: true }, master: { on: true, bypassMaster: false }, off: { on: false, bypassMaster: false },
    };
    const pdStaged = () => qPdStart !== null || qPdLanes !== null;
    const pdBody = () => {
      const start = qPdStart ?? pdSt.start ?? "master";
      const typed = qPdLanes?.trim();
      const maxLanes = typed === undefined ? pdSt.maxLanes ?? PROGRAM_DISPATCH_MAX_LANES_UI
        : typed === "" ? PROGRAM_DISPATCH_MAX_LANES_UI : Number(typed);
      return { dispatch: { v: 2 as const, ...START_BODY[start], maxLanes } };
    };
    // moved-UNKNOWN, exactly as the doors above count it: an unanswered request may well have been
    // applied, so the facts are re-read instead of the old state being repainted over a record
    // that has in truth already changed. Each route's refusal is the server's own sentence.
    const pdRun = async (writes: { what: string; path: string; body: unknown }[]): Promise<void> => {
      const seq = ++qPdSeq;
      const mine = () => seq === qPdSeq && qPdFor === forPdId;
      qPdBusy = true; qPdErr = null;
      qDetailKey = ""; renderQueueDetail();
      const errs: string[] = [];
      let moved = false;
      try {
        for (const w of writes) {
          const r = await post(w.path, w.body).catch(() => null);
          if (!r) { errs.push(`${w.what}: keine Antwort vom Server — ob es gesetzt wurde, ist unbekannt`); moved = true; continue; }
          if (r.ok) { moved = true; continue; }
          const j = (await r.json().catch(() => null)) as { error?: string } | null;
          errs.push(`${w.what} — ${r.status}: ${j?.error ?? "no readable reason"}`);
        }
      } finally {
        if (mine()) {
          qPdBusy = false;
          qPdErr = errs.length ? errs.join(" · ") : null;
          if (!errs.length) { qPdStart = null; qPdLanes = null; qPdRelease = null; }
          if (moved) await loadPrograms(true);
          qKey = ""; qDetailKey = "";
          renderQueue(); renderQueueDetail();
        } else if (moved) {
          await loadPrograms(true); qKey = ""; renderQueue();
        }
      }
    };

    // Grammatik G6.2 + G5.3 + G4.4: rows with the label left, the control right, the stored value in
    // mono, a one-sentence hint under the label; a changed row is only VORGEMERKT (ink edge), and the
    // one primary Apply at the end of the section writes it. The same row form as the settings
    // window's Fleet section (src/client.ts#fleetSection) — one grammar for a server setting.
    const pd = qDetailSection(shell.detail, "Program dispatch");
    const pdFacts = el("div", "ocfacts");
    pdFacts.appendChild(chip(pdSt.label, pdSt.tone, pdSt.sentence));
    pdFacts.appendChild(chip(
      pdSt.stamped ? `entschieden ${pdSt.stamped}` : pdSt.state === "unreadable" ? "kein lesbares Datum" : "nie entschieden", "dim",
      pdSt.stamped ? "confirmedAt des Servers — das Datum deiner Einstellung, keine Browser-Uhr"
        : "keine lesbare Einstellung gespeichert, also kein Datum"));
    pd.appendChild(pdFacts);
    pd.appendChild(el("div", "hint shellhint", pdSt.sentence));
    if (programsRead !== "ok") pd.appendChild(el("div", "pkdwarn",
      "Das letzte GET /api/programs kam nicht an — der Stand oben ist zwischengespeichert, nicht aktuell."
      + " Apply erreicht den Server trotzdem und darf wiederholt werden."));
    const pdRow = (label: string, hint: string, tip: string, staged: boolean, value: string) => {
      const row = el("div", `setrow fleetrow${staged ? " staged" : ""}`);
      row.title = tip;
      const main = el("div", "setmain");
      main.append(el("div", "setlabel", label), el("div", "hint setnote", hint));
      const val = el("span", "setval", value);
      val.title = "Wert, wie ihn der Server zuletzt gemeldet hat";
      const ctl = el("div", "setctl");
      row.append(main, val, ctl);
      pd.appendChild(row);
      return { row, ctl };
    };
    // Apply is enabled exactly while something is staged; every control re-stages IN PLACE — a
    // full detail repaint per pick would throw the pane's scroll position back to the top
    const syncApply = () => { apply.disabled = qPdBusy || !(pdStaged() || qPdRelease !== null); };
    const choice = <T extends string>(row: HTMLElement, ctl: HTMLElement, words: [T, string, string][], cur: T | null,
      staged: () => T | null, pick: (v: T | null) => void) => {
      const box = el("div", "setchoice");
      const btns: [T, HTMLButtonElement][] = [];
      const sync = () => {
        const st = staged();
        for (const [v, b] of btns) {
          b.classList.toggle("cur", v === cur);
          b.classList.toggle("staged", v === st);
          b.setAttribute("aria-pressed", (st ?? cur) === v ? "true" : "false");
        }
        row.classList.toggle("staged", st !== null);
      };
      for (const [v, word, tip] of words) {
        const b = el("button", "cmdlevel", word) as HTMLButtonElement;
        b.type = "button";
        b.title = tip;
        b.disabled = qPdBusy;
        // picking the stored value again un-stages the row
        b.onclick = () => { pick(v === cur ? null : v); sync(); syncApply(); };
        btns.push([v, b]);
        box.appendChild(b);
      }
      sync();
      ctl.appendChild(box);
    };

    // 1 · Lanes gleichzeitig — the program cap, independent of the start right (410e7029)
    const lanesRow = pdRow("Lanes gleichzeitig",
      "So viele Lanes dieses Programs laufen höchstens gleichzeitig; leer heißt Deckel der Maschine.",
      `Setzt den Program-Deckel (1 bis ${PROGRAM_DISPATCH_MAX_LANES_UI}); er kann den Deckel der Maschine nur senken, nie heben. intern: maxLanes`,
      qPdLanes !== null, pdSt.maxLanes !== null ? String(pdSt.maxLanes) : "Standard");
    const n = el("input", `setin setnum${qPdLanes !== null ? " staged" : ""}`) as HTMLInputElement;
    n.type = "number"; n.min = "1"; n.max = String(PROGRAM_DISPATCH_MAX_LANES_UI); n.step = "1"; n.inputMode = "numeric";
    n.placeholder = "Standard";
    n.setAttribute("aria-label", "Lanes gleichzeitig");
    n.value = qPdLanes ?? (pdSt.maxLanes !== null ? String(pdSt.maxLanes) : "");
    n.disabled = qPdBusy;
    const storedLanes = pdSt.maxLanes !== null ? String(pdSt.maxLanes) : "";
    // typing re-stages in place — a full repaint per keystroke would take the focus away
    n.oninput = () => {
      qPdLanes = n.value.trim() === storedLanes ? null : n.value;
      n.classList.toggle("staged", qPdLanes !== null);
      lanesRow.row.classList.toggle("staged", qPdLanes !== null);
      syncApply();
    };
    lanesRow.ctl.appendChild(n);

    // 2 · darf starten — an / aus / wie Master (the v2 record's on + bypassMaster)
    const startRow = pdRow("darf starten",
      "an: startet auch bei Master aus · wie Master: folgt dem Master · aus: startet nie von selbst.",
      "Ob die Fleet freigegebene Aufgaben dieses Programs ohne dich startet. intern: on, bypassMaster",
      qPdStart !== null, PD_START_WORD[pdSt.start ?? "master"]);
    choice(startRow.row, startRow.ctl, [
      ["on", "an", "Startet freigegebene Aufgaben dieses Programs auch, wenn der Master aus ist."],
      ["off", "aus", "Die Fleet startet keine Aufgabe dieses Programs von selbst, auch bei Master an; von Hand bleibt möglich."],
      ["master", "wie Master", "Dieses Program startet genau dann, wenn der Master-Schalter der Fleet an ist."],
    ], pdSt.start ?? (pdSt.state === "absent" ? "master" : null), () => qPdStart, (v) => { qPdStart = v; });

    // 3 · Freigabe — the release policy, its own route (POST /api/programs/:id/release)
    const releaseRow = pdRow("Freigabe",
      rlSt.sentence,
      "Welche wartenden Aufgaben dieses Programs ohne Einzelfreigabe als freigegeben gelten. intern: release policy",
      qPdRelease !== null, rlSt.policy ?? (rlSt.readable ? "Standard" : "unlesbar"));
    choice(releaseRow.row, releaseRow.ctl, [
      ["manual", "manual", "Jede Aufgabe wartet auf deine Freigabe."],
      ["card-valid", "card-valid", "Aufgaben mit gültiger Karte gelten ohne Einzelfreigabe als freigegeben."],
      ["all", "all", "Jede wartende Aufgabe dieses Programs gilt als freigegeben."],
    ], rlSt.policy ?? (rlSt.readable ? "manual" : null), () => qPdRelease, (v) => { qPdRelease = v; });

    if (qPdErr) pd.appendChild(el("div", "pkdwarn", qPdErr));
    const foot = el("div", "setfoot");
    foot.appendChild(el("div", "hint setnote",
      pdSt.stamped || rlSt.stamped ? `Freigabe ${rlSt.stamped ? `entschieden ${rlSt.stamped}` : "nie entschieden"}` : ""));
    const reset = el("button", "setreset", "Standard") as HTMLButtonElement;
    reset.type = "button";
    reset.title = "Löscht beide Einstellungen dieses Programs: es folgt wieder dem Master, dem Deckel der Maschine und wartet auf deine Freigabe.";
    reset.disabled = qPdBusy || (pdSt.state === "absent" && rlSt.policy === null && rlSt.readable);
    reset.onclick = () => {
      qPdStart = null; qPdLanes = null; qPdRelease = null;
      void pdRun([
        { what: "Program dispatch", path: `/api/programs/${forPdId}/dispatch`, body: { dispatch: null } },
        { what: "Freigabe", path: `/api/programs/${forPdId}/release`, body: { release: null } },
      ]);
    };
    const apply = el("button", "cmdapply", qPdBusy ? "Apply…" : "Apply") as HTMLButtonElement;
    apply.type = "button";
    apply.title = "Schreibt die vorgemerkten Zeilen an den Server; jede Ablehnung steht danach wörtlich hier.";
    syncApply();
    apply.onclick = () => {
      const writes: { what: string; path: string; body: unknown }[] = [];
      if (pdStaged()) writes.push({ what: "Program dispatch", path: `/api/programs/${forPdId}/dispatch`, body: pdBody() });
      if (qPdRelease !== null)
        writes.push({ what: "Freigabe", path: `/api/programs/${forPdId}/release`, body: { release: { v: 1, policy: qPdRelease } } });
      if (writes.length) void pdRun(writes);
    };
    foot.append(reset, apply);
    pd.appendChild(foot);
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
    st.appendChild(el("div", "hint shellhint", programsRead === "fail"
        ? "No button here: the last GET /api/programs did not answer, so this row is cached context"
          + " and its binding is unknown. Founding resumes when a fresh read succeeds — an unknown"
          + " binding is not an absent one, and bootstrap-main would 409 on one that still stands."
        : "No button here: nothing can be founded while the binding cannot even be read. Fix the"
          + " missing fact first — an unknown binding is not an absent one."));
    return;
  }
  if (mark === "stale") {
    const st = qDetailSection(shell.detail, "Binding");
    st.appendChild(el("div", "hint shellhint",
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
    pr.appendChild(el("div", "hint shellhint", p.status === "proposed"
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
      pr.appendChild(el("div", rq.state === "unreadable" ? "pkdwarn" : "hint shellhint", rq.sentence));
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
  bs.appendChild(el("div", "hint shellhint",
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
export function qLaneLine(join: QLaneJoin): HTMLElement | null {
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
    l.program === "unchecked" ? "program membership unchecked — this slot has no programId in the poll"
      : "program membership matches this row",
  ].filter(Boolean).join("\n");
  return line;
}
// what a repaint key needs of the joins: everything the line PAINTS except the quiet time, whose
// minute already rides the list key — keying on the raw ms would rebuild the list on every poll
export function qLaneKey(joins: ReadonlyMap<string, QLaneJoin>): unknown[] {
  return [...joins].map(([id, j]) => j.kind === "lane"
    ? [id, j.lane.slot, j.lane.branch, j.lane.state, j.lane.dirty, j.lane.ahead, j.lane.repo, j.lane.program]
    : j.kind === "refused" ? [id, j.slot, j.why] : null).filter(Boolean);
}
export const qLaneJoinOf = (id: string): QLaneJoin =>
  qLaneJoins(tasksList, fleet, dispatch.repo, serverNow).get(id) ?? { kind: "none" };

// THE REPO SHEET'S MODEL (Karte K2) — the executable rendering model over GET /api/repos/:canon/view,
// the sibling of programStatusRender one axe lower: the route joins the layers, this model names
// them. It accepts the route's JSON whole, and every layer contributes exactly one fact — so a
// layer the server stops serving is a MISSING fact with a named reason, never an invented zero.
// The `quelle` lines travel verbatim into the sentences: the model renders the route, it joins
// nothing and counts nothing the route did not already count. DOM-free on purpose — the e2e
// client-half check transpiles and runs exactly this block (see e2e/programs.ts, repo sheet).
export type RepoSheetFact = { label: string; tone: "ok" | "dim" | "warn"; sentence: string };
export interface RepoSheetRender { facts: RepoSheetFact[]; reason: string | null }
export interface RepoSheetView {
  repo?: unknown;
  layers?: {
    lanes?: { quelle?: unknown; rows?: unknown };
    queue?: { quelle?: unknown; rows?: unknown; nullRepoWithoutTarget?: unknown };
    lands?: { quelle?: unknown; limit?: unknown; total?: unknown; rows?: unknown };
    audit?: { quelle?: unknown; row?: unknown };
    deploy?: { quelle?: unknown; deploy?: unknown; deployGrund?: unknown };
    cap?: { quelle?: unknown; max?: unknown; source?: unknown };
  };
  unknown?: unknown;
}
export function repoSheetFacts(view: RepoSheetView | null, read: "ok" | "fail"): RepoSheetRender {
  if (read !== "ok") return { facts: [], reason: read === "fail"
    ? "The last GET /api/repos/:canon/view did not answer, so this repo's layers are unreadable."
    : "GET /api/repos/:canon/view has not been read yet, so this repo's layers are unknown." };
  const layers = view?.layers;
  const str = (v: unknown): string => typeof v === "string" ? v : "";
  const count = (v: unknown): number => Array.isArray(v) ? v.length : 0;
  const missing: string[] = [];
  const facts: RepoSheetFact[] = [];
  if (!Array.isArray(layers?.lanes?.rows) || typeof layers?.lanes?.quelle !== "string") missing.push("lanes (L3)");
  else {
    const n = count(layers.lanes.rows);
    facts.push({ label: `${n} open lane${n === 1 ? "" : "s"}`, tone: n > 0 ? "ok" : "dim",
      sentence: str(layers.lanes.quelle) });
  }
  if (!Array.isArray(layers?.queue?.rows) || typeof layers?.queue?.quelle !== "string") missing.push("queue (L2)");
  else {
    const n = count(layers.queue.rows);
    const stray = layers.queue.nullRepoWithoutTarget;
    facts.push({ label: `${n} queue row${n === 1 ? "" : "s"}`, tone: n > 0 ? "warn" : "dim",
      sentence: str(layers.queue.quelle)
        + (typeof stray === "number" && stray > 0
          ? ` — ${stray} null-repo row${stray === 1 ? "" : "s"} target no repo (FLEET_DISPATCH_REPO unset)` : "") });
  }
  if (!Array.isArray(layers?.lands?.rows) || typeof layers?.lands?.quelle !== "string"
    || typeof layers?.lands?.total !== "number") missing.push("lands (L4)");
  else {
    const shown = count(layers.lands.rows);
    const total = layers.lands.total as number;
    facts.push({ label: `${shown}/${total} lands`, tone: "dim",
      sentence: str(layers.lands.quelle)
        + (shown < total ? " — oldest lands beyond the route's limit are not shown" : "") });
  }
  if (layers?.audit === undefined || typeof layers?.audit?.quelle !== "string") missing.push("audit (L5)");
  else {
    const row = (layers.audit.row ?? null) as { result?: unknown; adjudicated?: unknown; fails?: unknown } | null;
    const result = typeof row?.result === "string" ? row.result : null;
    const adjudicated = typeof row?.adjudicated === "string" ? row.adjudicated : null;
    const fails = Array.isArray(row?.fails) ? row.fails.length : 0;
    facts.push({ label: result === null ? "no audit" : `audit ${result}`,
      tone: result === "green" ? "ok" : result === "red" ? "warn" : "dim",
      sentence: str(layers.audit.quelle)
        + (adjudicated ? ` — adjudicated: ${adjudicated}` : "")
        + (fails > 0 ? ` — ${fails} named fail${fails === 1 ? "" : "s"}` : "") });
  }
  if (layers?.deploy === undefined || typeof layers?.deploy?.quelle !== "string") missing.push("deploy (L6)");
  else {
    const cell = (layers.deploy.deploy ?? null) as { codeBehind?: unknown } | null;
    const grund = typeof layers.deploy.deployGrund === "string" ? layers.deploy.deployGrund : null;
    const behind = cell === null ? null : typeof cell.codeBehind === "boolean" ? cell.codeBehind : null;
    facts.push({ label: grund !== null ? grund : behind === null ? "deploy not yet read"
        : behind ? "deploy: code behind" : "deploy: current",
      tone: behind === true ? "warn" : behind === false ? "ok" : "dim",
      sentence: str(layers.deploy.quelle) });
  }
  if (layers?.cap === undefined || typeof layers?.cap?.quelle !== "string"
    || typeof layers?.cap?.max !== "number") missing.push("lane cap");
  else {
    const src = typeof layers.cap.source === "string" ? layers.cap.source : "unknown";
    facts.push({ label: `lane cap ${layers.cap.max} (${src})`, tone: "dim",
      sentence: str(layers.cap.quelle) });
  }
  if (!Array.isArray(view?.unknown)) missing.push("unknown");
  return {
    facts,
    reason: read === "ok" && view?.repo === undefined ? "The answer names no repo — this sheet cannot say what it read."
      : missing.length > 0 ? `The answer omits ${missing.join(", ")} — the server's sheet is incomplete this build cannot repair.`
      : null,
  };
}

// the repo sheet's DOM painter — one fetch per open (and per "read again"), never a poll
// subscription: the layers are auf Abruf, and an auto-refresh here would be the 2-s ledger poll
// through the client's back door. Every ROW line below is printed in the order and the shape the
// ROUTE served; the pane computes nothing the route did not already count.
export function renderRepoDetail(shell: Shell, repo: string): void {
  shell.detail.appendChild(el("div", "rvhead", baseName(repo)));
  shell.detail.appendChild(el("div", "hint shellhint", repo));
  const body = el("div", "");
  shell.detail.appendChild(body);
  let seq = 0; // a re-open or refresh orphans every fetch still in flight
  const paint = async (): Promise<void> => {
    const mine = ++seq;
    body.replaceChildren(el("div", "hint shellhint",
      "reading GET /api/repos/:canon/view — the layers are fetched on demand; the poll does not keep this pane fresh"));
    const r = await api(`/api/repos/${encodeURIComponent(repo)}/view`).catch(() => null);
    if (mine !== seq || !body.isConnected) return;
    if (!r || !r.ok) {
      body.replaceChildren(el("div", "hint shellhint", r
        ? `GET /api/repos/:canon/view answered ${r.status} — the layers of this repo are unreadable.`
        : "No answer — the layers of this repo are unknown right now."));
      return;
    }
    const v = (await r.json().catch(() => null)) as RepoSheetView | null;
    if (mine !== seq || !body.isConnected) return;
    body.replaceChildren();
    const rendered = repoSheetFacts(v, "ok");
    if (rendered.reason) body.appendChild(el("div", "pkdwarn", rendered.reason));
    const facts = el("div", "ocfacts");
    for (const f of rendered.facts) facts.appendChild(chip(f.label, f.tone, f.sentence));
    body.appendChild(facts);
    if (!v) return;
    const line = (parent: HTMLElement, text: string): void => { parent.appendChild(el("div", "qdtext", text)); };
    const L = v.layers;
    if (L?.lanes?.rows && Array.isArray(L.lanes.rows)) {
      const sec = qDetailSection(body, "Lanes (L3)");
      sec.appendChild(el("div", "hint shellhint", `quelle: ${String(L.lanes.quelle)}`));
      for (const row of L.lanes.rows) {
        const l = row as { slot?: unknown; branch?: unknown; taskId?: unknown; programId?: unknown };
        line(sec, `⎇ ${String(l.branch)} · slot ${String(l.slot)}`
          + (l.taskId ? ` · ${String(l.taskId)}` : "") + (l.programId ? ` · prog ${String(l.programId)}` : ""));
      }
    }
    if (L?.queue?.rows && Array.isArray(L.queue.rows)) {
      const sec = qDetailSection(body, "Queue (L2)");
      sec.appendChild(el("div", "hint shellhint", `quelle: ${String(L.queue.quelle)}`));
      for (const row of L.queue.rows) {
        const q = row as { id?: unknown; status?: unknown; text?: unknown };
        line(sec, `[${String(q.status)}] ${String(q.id)} — ${String(q.text)}`);
      }
    }
    if (L?.lands?.rows && Array.isArray(L.lands.rows)) {
      const sec = qDetailSection(body, "Lands (L4)");
      sec.appendChild(el("div", "hint shellhint", `quelle: ${String(L.lands.quelle)}`));
      for (const row of L.lands.rows) {
        const d = row as { at?: unknown; branch?: unknown; verified?: unknown; mainAfter?: unknown };
        line(sec, `${typeof d.at === "number" ? fmtTs(d.at) : "?"} · ${String(d.branch)} · verify ${
          d.verified === true ? "✓" : d.verified === false ? "✗" : "—"}`
          + (typeof d.mainAfter === "string" ? ` · ${d.mainAfter.slice(0, 12)}` : ""));
      }
    }
    if (L?.audit !== undefined) {
      const sec = qDetailSection(body, "Audit (L5)");
      sec.appendChild(el("div", "hint shellhint", `quelle: ${String(L.audit.quelle)}`));
      const a = (L.audit.row ?? null) as { at?: unknown; result?: unknown; adjudicated?: unknown; fails?: unknown } | null;
      if (a === null) line(sec, "no audit row for this repo");
      else line(sec, `${String(a.result)} @ ${typeof a.at === "number" ? fmtTs(a.at) : "?"}`
        + (a.adjudicated ? ` · adjudicated: ${String(a.adjudicated)}` : " · not adjudicated")
        + (Array.isArray(a.fails) && a.fails.length ? ` · fails: ${a.fails.map(String).join(", ")}` : ""));
    }
    if (L?.deploy !== undefined) {
      const sec = qDetailSection(body, "Deploy (L6)");
      sec.appendChild(el("div", "hint shellhint", `quelle: ${String(L.deploy.quelle)}`));
      const d = (L.deploy.deploy ?? null) as { codeBehind?: unknown } | null;
      line(sec, d === null ? String(L.deploy.deployGrund)
        : typeof d.codeBehind === "boolean" ? (d.codeBehind ? "code behind" : "current")
        : "not yet read (git tick)");
    }
    if (L?.cap !== undefined) {
      const sec = qDetailSection(body, "Lane cap");
      sec.appendChild(el("div", "hint shellhint", `quelle: ${String(L.cap.quelle)}`));
      line(sec, `max ${String(L.cap.max)} (${String(L.cap.source)})`);
    }
    for (const u of Array.isArray(v.unknown) ? v.unknown : [])
      body.appendChild(el("div", "pkdwarn", String(u)));
  };
  const foot = el("div", "qdsection");
  const again = el("button", "shrbtn", "read again") as HTMLButtonElement;
  again.title = "one fetch, on demand — the poll never refreshes this pane by itself";
  again.onclick = () => void paint();
  foot.appendChild(again);
  shell.detail.appendChild(foot);
  void paint();
}

export function renderQueueDetail() {
  const shell = qShell;
  if (!shell) return;
  // A meaningful poll can repaint this pane while the owner is typing. The draft nodes themselves
  // survive below; restore focus and selection after moving them back into the new section tree.
  const focused = document.activeElement;
  const selection = focused instanceof HTMLTextAreaElement || focused instanceof HTMLInputElement
    ? { start: focused.selectionStart, end: focused.selectionEnd, direction: focused.selectionDirection }
    : null;
  const restoreFocus = () => {
    // every paint ends here, so this is where the pane's task ids become hoverable
    qMarkIds(shell.detail);
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
  // BUNDLE MODE owns the pane: what the marked rows would become, before the one click makes it
  if (qBundleMode) {
    shell.detail.appendChild(el("div", "qdtitle-t", "Bundle"));
    shell.detail.appendChild(el("div", "hint shellhint", "Click rows on the left to mark them. The bundle is one new"
      + " row carrying every marked text whole; the marked rows are archived as \"gebündelt in <id>\", and"
      + " ⧉ auflösen on the bundle restores them — released ones released again."));
    const ids = [...qSel];
    for (const id of ids) {
      const line = el("div", "qbundlesrc");
      line.append(el("span", "qbundleid", id), el("span", "", qRowTitle(qTaskText(id),
        programsList.find((p) => p.id === tasksList.find((x) => x.id === id)?.programId)?.title, taskCardFull.get(id)?.ziel)));
      shell.detail.appendChild(line);
    }
    if (ids.length > 1) {
      const draft = qBundleDraft(ids);
      shell.detail.appendChild(typeof draft === "string"
        ? el("div", "qdfind unk", draft)
        : el("div", "hint shellhint", `→ one ${draft.queue ? "released" : "pending"} row`
          + `${draft.programId ? ` in ${programsList.find((p) => p.id === draft.programId)?.title ?? draft.programId}` : ""}`
          + `, ${draft.text.length} characters`));
    }
    restoreFocus();
    return;
  }
  if (qPick === null) {
    if (qView === "notes") {
      const notes = tasksList.filter(qInScope).filter((t) => qGroupOf(t) === "notes");
      qPaintNotesOverview(shell.detail, qNotesAggregate(notes, programsList, qAttachedNoteIds(), Date.now()), (pid) => {
        shell.list.querySelector<HTMLElement>(`.shellsec[data-prog="${CSS.escape(pid)}"]`)
          ?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
      restoreFocus();
      return;
    }
    if (qView !== "work") {
      const emptyDetail = qView === "programs"
        ? ["Programs", "Select a Program to inspect its binding, lifecycle and owner controls."]
        : qView === "history"
          ? ["History", "Select a done or archived task to inspect its record."]
          : qView === "konzepte"
            ? ["Konzepte", "Waehle ein Konzept: seine aktuelle Version und die Anmerkungen dazu."]
            : ["Waves", "Select a projected task to inspect its evidence and actions."];
      shell.detail.appendChild(el("div", "rvhead", emptyDetail[0]));
      shell.detail.appendChild(el("div", "hint shellhint", emptyDetail[1]));
      restoreFocus();
      return;
    }
    // THE NEW-TASK FORM (owner, 2026-09-19: „[Zitat entfernt]“): a title
    // and one line on what happens to it, the text, the two fields side by side under labels, and
    // the one button at the bottom right — ⌘/Ctrl+Enter from the text does the same.
    const form = el("div", "qnewform");
    shell.detail.appendChild(form);
    form.appendChild(el("div", "qdtitle-t", "New task"));
    form.appendChild(el("div", "qnewsub",
      "Lands as pending. Only you release it — and only a released task can be picked up by the dispatcher."));
    if (!qCompose) {
      qCompose = el("textarea", "qaddin qnewtext") as HTMLTextAreaElement;
      qCompose.placeholder = "Describe a feature or a fix — what should be true when it is done?";
      qCompose.rows = 10;
    }
    form.appendChild(qCompose);
    if (!qRepoIn) {
      qRepoIn = el("input", "qaddin") as HTMLInputElement;
      // REQUIRED, and said so on the control itself. Empty was never "no repo": the server reads
      // an absent repo as the dispatch default, so the quiet path put tasks in the Fleet checkout
      // that were never meant for it. The button below refuses instead of posting.
      qRepoIn.placeholder = "path — required";
      qRepoIn.title = "where this task's lane spawns; suggestions come from your pinned/recent projects";
      qRepoIn.setAttribute("list", "qrepodl");
      void ensureRepoDatalist();
    }
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
    const field = (label: string, control: HTMLElement, hint: string) => {
      const f = el("label", "qnewfield");
      f.append(el("span", "qnewlabel", label), control, el("span", "hint qnewhint", hint));
      return f;
    };
    const fields = el("div", "qnewfields");
    fields.append(
      field("Repo", qRepoIn, dispatch.repo
        ? `required — empty would silently fall back to ${baseName(dispatch.repo)}`
        : "required — empty would silently fall back to the server's dispatch default"),
      field("Program", qProgSel, bindable.length ? "optional — confirmed or active programs only"
        : programsRead === "fail" ? "GET /api/programs did not answer — none offered until a fresh read"
        : programsRead === "unread" ? "programs have not been read yet"
        : "no confirmed or active program exists"));
    form.appendChild(fields);
    const add = el("button", "shrbtn primary", "Create task") as HTMLButtonElement;
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
    qCompose.onkeydown = (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); add.click(); }
    };
    const foot = el("div", "qnewfoot");
    foot.append(el("span", "qnewkey", "⌘↵"), add);
    form.appendChild(foot);
    restoreFocus();
    return;
  }
  if (qPick.startsWith("repo:")) {
    renderRepoDetail(shell, qPick.slice(5));
    restoreFocus();
    return;
  }
  if (qPick.startsWith("konz:")) {
    renderKonzeptDetail(shell, qPick.slice(5));
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
    shell.detail.appendChild(el("div", "hint shellhint", "that task is gone — it was completed or deleted"));
    restoreFocus();
    return;
  }
  const brief = taskBriefFull.get(t.id);
  const crit = taskCriterionFull.get(t.id) ?? t.criterion;
  // THE TITLE FIRST (owner, 2026-09-18: „[Zitat entfernt]“): what this row IS, in its own words,
  // with the same chips its list row carries — minus program, which the head's facts name below.
  const summary = qTaskSummary(t, qTaskText(t.id), Date.now(), programsList);
  // D2 (owner, 2026-09-19): a READING column and a RAIL beside it. What is read — card,
  // discussion, texts — runs down the left under the title; status, the one action, the few options
  // and where the row lives sit in the rail, which keeps its place while the column scrolls. The
  // title is a node of its own so a phone can stack title → rail → column.
  const d2 = el("div", "qd2");
  const read = el("div", "qdread");
  const rail = el("div", "qdrail");
  shell.detail.appendChild(d2);
  // the lifecycle stripe of the list row, beside the title too (held reads as waiting; a note and a
  // closed row carry none)
  const stage = qAdvisory(t) || qClosed(t) ? "" : t.hold ? "held" : t.status;
  const titleBox = el("div", `qdtitle${stage ? ` q-st-${stage}` : ""}`);
  titleBox.appendChild(el("div", "qdtitle-t", summary.title));
  const titleChips = el("div", "qchips");
  for (const c of summary.chips.filter((c) => c.cls !== "prog")) {
    const span = el("span", `qchip qc-${c.cls.split(" ").join(" qc-")}`, c.text);
    if (c.title) span.title = c.title;
    titleChips.appendChild(span);
  }
  titleChips.appendChild(el("span", "qdtitle-id", t.id));
  titleBox.appendChild(titleChips);
  d2.append(titleBox, read, rail);
  // --- DETAIL HEAD (paint): the plan from qHeadPlan, painted at the TOP OF THE RAIL — status,
  // the lifecycle rail, and the ONE main action with the single line that says what it does.
  // Program and target repo are built here and shown under "place", below the acts. Nothing else
  // may be appended between here and the first section: the next decision is readable at 1440×900
  // without scrolling, and the rail keeps it there while the reading column scrolls.
  const laneJoin = qLaneJoinOf(t.id);
  const head = qHeadPlan({
    status: t.status, kind: t.kind, slot: t.slot, repo: t.repo, programId: t.programId,
  }, programsList.find((x) => x.id === t.programId)?.title ?? null,
  laneJoin.kind === "lane" ? { kind: "lane", slot: laneJoin.lane.slot } : { kind: laneJoin.kind });
  // the status line: the state in ink, how long the row has existed beside it. No "status" label
  // above it — the stepper right under it says what kind of fact this is.
  const statusLine = el("div", "rvhead qdhead-status");
  const age = el("span", "qdhead-age", summary.age.text);
  if (summary.age.title) age.title = summary.age.title;
  statusLine.append(el("span", "", head.status), age);
  rail.appendChild(statusLine);
  // where the row lives, as two key/value lines under the options (owner, 2026-09-19: the rail
  // was „[Zitat entfernt]“ — two chips and a PLACE header said less than two labelled lines)
  const headFacts = el("div", "ocfacts qdhead-facts");
  const fact = (k: string, v: string, title: string) => {
    const row = el("div", "qdfact");
    row.title = title;
    row.append(el("span", "qdfact-k", k), el("span", "qdfact-v", v));
    headFacts.appendChild(row);
  };
  fact("program", head.program, t.programId
    ? `this row is bound to program ${t.programId}`
    : "this row belongs to no program — it is loose queue work");
  fact("repo", head.repo, t.repo
    ? `target repo: ${t.repo} — this task's lane spawns there`
    : "this row names no target repo — a dispatch would fall back to the server's default");
  // THE LIFECYCLE RAIL, drawn as a stepper (owner, 2026-09-19: „[Zitat entfernt]“
  // ): a dot per station on one track, the walked part of the track filled. Only
  // facts from this poll: a station is `on`, an earlier one `past`, everything else plain — and an
  // archived row marks NO station, because the poll does not carry the walk it once made.
  const life = el("div", "qlife");
  life.title = "pending → queued → sent → landed/done, as this poll reads it."
    + " archived and advisory are ends of their own, not stations on that rail";
  head.life.stations.forEach((station, i) => {
    const on = head.life.current === station;
    const past = head.life.reached > i && !on;
    const st = el("span", `qlife-st${on ? " on" : past ? " past" : ""}`, station);
    if (station === "done") st.title = "landed or done";
    life.appendChild(st);
  });
  if (head.life.current === "archived" || head.life.current === "advisory"
    || head.life.current === "unknown")
    life.appendChild(el("span", "qlife-st end on", head.life.current));
  rail.appendChild(life);
  // the one action's own row. Filled from the act placement below (`place`), so the button that
  // lands here is the very same node, with the very same handler, that Actions would have held.
  const mainBox = el("div", "qdmain");
  rail.appendChild(mainBox);
  rail.appendChild(el("div", "qdmain-why", head.main.why));
  // THE CARD, right under the one action: what the row wants done and how that is checked — the
  // part of a long text the owner decides on. Drawn only when the extractor wrote one.
  const card = taskCardFull.get(t.id);
  if (card) {
    const sec = qDetailSection(read, "Card" + (card.valid === false ? " · has gaps" : ""));
    const field = (label: string, value: string | undefined) => {
      if (!value) return;
      const row = el("div", "qcardrow");
      row.append(el("span", "qcardk", label), el("span", "qcardv", value));
      sec.appendChild(row);
    };
    field("goal", card.ziel);
    field("done", card.done);
    field("verify", card.verify);
    const role = card.rolle ? [card.rolle.harness, card.rolle.model, card.rolle.effort].filter(Boolean).join(" · ") : "";
    field("role", role || undefined);
    if (card.after?.length) {
      const row = el("div", "qcardrow");
      row.appendChild(el("span", "qcardk", "after"));
      const v = el("span", "qcardv");
      for (const id of card.after) {
        const dep = tasksList.find((x) => x.id === id);
        const a = el("span", "qbundleid go", `${id}${dep ? ` (${dep.status})` : ""}`);
        if (dep) a.onclick = () => qSelect(id);
        v.appendChild(a);
      }
      row.appendChild(v);
      sec.appendChild(row);
    }
    if (card.verboten?.length) {
      const d = document.createElement("details");
      d.className = "qcardmore";
      d.appendChild(el("summary", "", `${card.verboten.length} forbidden`));
      for (const v of card.verboten) d.appendChild(el("div", "qcardv", `– ${v}`));
      sec.appendChild(d);
    }
    if (card.gaps?.length) sec.appendChild(el("div", "qdfind unk", `gaps: ${card.gaps.join(" · ")}`));
  }
  // THE BUNDLE TRAIL: which rows this one was made from, each one click away (they are in
  // History, archived as "gebündelt in <this id>"), and the way back while the bundle has not run.
  const bundleSources = qBundleSources(qTaskText(t.id));
  if (bundleSources.length) {
    const sec = qDetailSection(read, `Bundle · ${bundleSources.length} sources`);
    for (const src of bundleSources) {
      const row = tasksList.find((x) => x.id === src);
      const line = el("div", "qbundlesrc");
      line.appendChild(el("span", "qbundleid", src));
      line.appendChild(el("span", "", row ? `${row.status} · ${qFirstLine(qTaskText(src)).slice(0, 90)}`
        : "evicted from the state file — ⧉ auflösen restores it from tasks-archive.jsonl"));
      if (row) { line.classList.add("go"); line.onclick = () => qSelect(src); }
      sec.appendChild(line);
    }
    if (t.status === "pending" || t.status === "queued") {
      const undo = el("button", "shrbtn", "⧉ auflösen") as HTMLButtonElement;
      undo.title = "restore every source as pending and archive this bundle — the texts were never changed";
      undo.disabled = qBundleBusy;
      undo.onclick = () => void qDissolveBundle(t);
      sec.appendChild(undo);
    } else sec.appendChild(el("div", "hint shellhint", t.status === "archived"
      ? "this bundle is archived — dissolved, or set aside; its sources are listed above"
      : `this bundle is ${t.status} — past the point where it can be split back`));
  }
  // A NOTE GOES TO ITS TASK from the note's own pane: the owner is looking at the note when he
  // knows where it belongs. Same door as the auftrag side (POST /api/tasks/:id/notes).
  if (t.kind === "notiz" && !qClosed(t)) {
    const holders = tasksList.filter((x) => !qClosed(x) && !qAdvisory(x)
      && (taskNotesFull.get(x.id) ?? []).some((pin) => pin.noteId === t.id));
    const sec = qDetailSection(read, "Attached to");
    for (const h of holders) {
      const line = el("div", "qbundlesrc go");
      line.append(el("span", "qbundleid", h.id), el("span", "", qFirstLine(qTaskText(h.id)).slice(0, 90)));
      line.onclick = () => qSelect(h.id);
      sec.appendChild(line);
    }
    const repo = qTaskRepo(t);
    const targets = tasksList.filter((x) => !qClosed(x) && !qAdvisory(x) && x.status !== "sent"
      && qTaskRepo(x) === repo && !holders.includes(x))
      .sort((a, b) => Number(b.programId === t.programId) - Number(a.programId === t.programId) || b.created - a.created);
    if (targets.length) {
      const pickRow = el("div", "qattach");
      const sel = el("select", "qkind-select") as HTMLSelectElement;
      for (const x of targets) {
        const o = el("option", "", `${x.programId === t.programId && x.programId ? "● " : ""}${qFirstLine(qTaskText(x.id)).slice(0, 70)}`) as HTMLOptionElement;
        o.value = x.id;
        sel.appendChild(o);
      }
      const go = el("button", "shrbtn", "📎 attach") as HTMLButtonElement;
      go.title = "the note rides under that task in the list and is handed to its lane as a source";
      go.onclick = () => void qAct(sel.value, "notes", { note: t.id, attach: true });
      pickRow.append(sel, go);
      sec.appendChild(pickRow);
    } else if (!holders.length) sec.appendChild(el("div", "hint shellhint", "no open task in this repo to attach it to"));
  }
  // WHAT HANGS OFF THE ROW, right under what can be done with it: assigned notes, verdicts, and
  // the comment thread. Never a fold — the comment box is a draft a repaint must not close.
  const discussion = qDetailSection(read, "Notes & comments");
  const hasRefinement = (!qAdvisory(t) && (t.status === "pending" || t.status === "queued"))
    || brief !== undefined || crit !== undefined;
  const refinement = hasRefinement ? qDetailSection(read, "Refinement") : null;
  // Once a compiled brief exists, the original request is supporting evidence rather than the
  // primary working text. Keep it one click away; raw tasks stay open because it is all they have.
  const request = qDetailSection(read, "Request", true, brief === undefined || qShowOriginal === t.id);
  // EVIDENCE: the lane this row is running in, or why none attaches (a `sent` row with nothing
  // attached is the state the owner must be able to read). Verify facts are NOT on the owner
  // poll, and the section says that rather than leaving the absence to be read as a green run.
  const evidence = qDetailSection(read, "Evidence — lane & verify facts", true, false);
  const laneLine = qLaneLine(laneJoin);
  if (laneLine) {
    evidence.appendChild(laneLine);
    if (laneJoin.kind === "refused") evidence.appendChild(el("div", "hint shellhint", laneJoin.why));
  } else {
    evidence.appendChild(el("div", "hint shellhint", "no lane pointer on this row"));
  }
  evidence.appendChild(el("div", "hint shellhint",
    "verify and land facts are not on this poll — unknown here, not green"));
  // the row's provenance and its file surface: evidence for bundling and waves, folded, because
  // it answers "why is it grouped like that", not "what do I do next"
  const overview = qDetailSection(read, "Details — surface, cluster, provenance", true, false);
  const meta = el("div", "ocfacts");
  meta.appendChild(chip(taskSourceLabel(t)));
  if (qAdvisory(t)) meta.appendChild(chip(`${t.kind} — not work`, "dim",
    "an advisory row does not assign work. Change its Kind to auftrag to enter the normal workflow"));
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
  // THE ORIGIN AS ITS OWN CHIP (2026-09-13): „[Zitat entfernt]“ sits between the other two and bundles by a
  // different rule than either, so it is named where the eye lands rather than inside the sentence.
  if (t.files?.length && t.filesOrigin) overview.appendChild(chip(t.filesOrigin,
    t.filesOrigin === "confirmed" ? "ok" : t.filesOrigin === "card" ? "" : "dim",
    t.filesOrigin === "confirmed" ? "confirmed surface — bundles on a shared file or on nearby ranges"
      : t.filesOrigin === "card" ? "card surface, lifted without a confirming act — bundles only where both rows"
        + " name nearby ranges (FLEET_CARD_AUTOLIFT); confirming it below makes it a confirmed surface"
        : "derived from prose — never bundled until confirmed"));
  overview.appendChild(el("div", "hint shellhint", t.files?.length
    ? `known files · ${origin}: ${t.files.join(", ")}`
    : "file surface unknown — absence is not an empty surface"));
  // The PROPOSED surface, drawn UNDER the standing one and never merged into it: holding those two
  // lines against each other is exactly the act the button below ends, so a rendering that showed
  // only the winner would remove the reason to click. Only the owner sees this button — the propose
  // door is a self route, and there is no self mirror of the confirm.
  const fprop = t.filesProposal;
  if (fprop) {
    overview.appendChild(el("div", "hint shellhint",
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
    overview.appendChild(el("div", "hint shellhint",
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
  if (t.cluster) overview.appendChild(el("div", "hint shellhint",
    `cluster projection: ${[t.cluster.projekt, t.cluster.prozess, t.cluster.unterprozess].filter(Boolean).join(" / ")}`));
  else overview.appendChild(el("div", "hint shellhint", "cluster projection unavailable"));
  if (qView === "waves") {
    const location = qWaveLocation(t.id, qWaveProjection());
    if (location?.kind === "wave") overview.appendChild(el("div", "hint shellhint",
      `Waves: Wave ${location.wave} in ${baseName(location.repo)} — no known file intersection.`));
    else if (location?.kind === "unresolved") {
      const why = location.item.reason === "unknown-files" ? "file surface unknown"
        : location.item.reason === "unknown-repo" ? "target repo unknown" : "lane capacity is zero";
      overview.appendChild(el("div", "hint shellhint", `Waves: outside — ${why}.`));
    }
  }
  // N3 · SOURCES / VERDICTS — above the comments, because an assignment is an INSTRUCTION and a
  // comment is a remark: the section that decides what a lane will be handed belongs over the one
  // that decides how it should feel about it. Only one of the two ever shows on a row — an auftrag
  // NAMES sources, a notiz IS one and carries the reports given under each task.
  if (t.kind === "auftrag" || (t.notes?.n ?? 0) > 0) {
    const pins = taskNotesFull.get(t.id) ?? [];
    const rows = qNoteSourceRows(pins, tasksList, taskText);
    discussion.appendChild(el("div", "rvhead", rows.length ? `Quellen · ${rows.length}` : "Quellen"));
    if (rows.length === 0) discussion.appendChild(el("div", "hint shellhint",
      "keine — diese Zeile bekommt Notizen nur ueber die Datei-Flaeche, als Hinweis, nicht als Auftrag"));
    for (const row of rows) {
      qTextBlock(discussion, row.noteId, row.text);
      const line = el("div", "pkdacts");
      // "unknown" is rendered as itself. A pinned id the queue no longer answers is not an empty
      // assignment: the lane's own brief will report it the same way, and hiding it here would
      // make the two surfaces disagree about the one fact this section exists to show.
      line.appendChild(el("div", "hint shellhint", row.known
        ? `${row.status} · angeheftet von ${row.by}`
        : "unbekannt — keine Queue-Zeile traegt diese Id mehr"));
      const rx = el("button", "shrbtn", "\u2715") as HTMLButtonElement;
      rx.title = "detach this source — the note keeps its row, its text and every verdict already given under this task";
      rx.onclick = () => void qAct(t.id, "notes", { note: row.noteId, attach: false });
      line.appendChild(rx);
      discussion.appendChild(line);
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
      discussion.appendChild(abox);
      discussion.appendChild(aacts);
    } else discussion.appendChild(el("div", "hint shellhint",
      `die Zuordnung ist eingefroren: ein Land-Brief ist aus ihr gebaut worden (${t.status})`));
  }
  if (t.kind === "notiz") {
    const vs = qNoteVerdictRows(taskVerdictsFull.get(t.id) ?? [], tasksList);
    discussion.appendChild(el("div", "rvhead", vs.length ? `Urteile je Aufgabe · ${vs.length}` : "Urteile je Aufgabe"));
    if (vs.length === 0) discussion.appendChild(el("div", "hint shellhint",
      "keins — diese Notiz wurde noch unter keiner Aufgabe beurteilt"));
    for (const v of vs) {
      discussion.appendChild(el("div", "qdtext", v.text));
      // WHICH ROW'S LAND makes it wirksam, named in full: a task-scoped `erledigt` closes this note
      // at the land of THAT row and of no other, which is exactly the sentence a reader needs in
      // order not to read it as the old global claim.
      discussion.appendChild(el("div", "pkdacts", `${v.verdict} · ${v.branch} · zu ${v.taskId}`
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
  commentThread(discussion, { kind: "task", id: t.id }, "comments", cms.map((c) => ({
    id: c.id, ts: c.ts, text: c.text, label: c.from ?? "comment",
    // WHO said it and WHAT they claimed, beside the timestamp. Only `erledigt` ever moves this row,
    // and only when the branch that wrote it lands — said here rather than left to be inferred,
    // because a `widerlegt` sitting under a still-pending note otherwise reads as an ignored report.
    lines: c.verdict ? [`${c.verdict} · ${c.from ?? "lane"}${c.verdict === "erledigt" ? " — closes this note when that branch lands" : ""}`] : [],
    act: { text: "✕", title: "delete this comment", run: () => void qAct(t.id, "comment-delete", { comment: c.id }) },
  })), {
    placeholder: "leave a comment on this task…", button: "💬 comment",
    title: "a remark for whoever picks this up — read, never executed:"
      + " it is not appended to the brief the lane receives",
    send: (text) => qAct(t.id, "comment", { text }),
  });
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
    qTextBlock(refinement!, "brief", brief.text);
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
      qTextBlock(refinement!, "done-criterion", crit.text ?? "");
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
  // HOW THE ROW ARRIVED (owner, 2026-09-19: „[Zitat entfernt]“
  // ). No — the brief is a rewrite. This strip names
  // each text the row has had, in order, and every step opens the section that holds it.
  const openAt = (bodyEl: HTMLElement | null) => {
    const sec = bodyEl?.parentElement;
    if (!sec) return;
    if (sec instanceof HTMLDetailsElement) sec.open = true;
    sec.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  const arrived = el("div", "qorigin");
  const step = (label: string, sub: string, target: HTMLElement | null, title: string) => {
    const b = el("button", "qorigin-st", "") as HTMLButtonElement;
    b.type = "button";
    b.title = title;
    b.append(el("span", "qorigin-l", label), el("span", "qorigin-s", sub));
    b.onclick = () => openAt(target);
    if (arrived.querySelector(".qorigin-st")) arrived.appendChild(el("span", "qorigin-arrow", "→"));
    arrived.appendChild(b);
  };
  arrived.appendChild(el("span", "qorigin-h", "arrived as"));
  step("original", `${taskSourceLabel(t)} · ${fmtTs(t.created)}`, request,
    "the text exactly as it was filed — under Request");
  // the original stays open across the poll's repaints once asked for — otherwise the next
  // repaint folds it again under the reader (measured in the preview, 2026-09-19)
  arrived.querySelector(".qorigin-st")?.addEventListener("click", () => { qShowOriginal = t.id; });
  if (brief) step("brief", `${brief.edited ? (briefByMain(brief) ? "by its MAIN" : "yours") : "compiled"} · ${fmtTs(brief.at)}`,
    refinement, "a rewrite of the original — this is what a lane receives; under Refinement");
  if (crit) step("criterion", crit.confirmedAt !== null ? `confirmed · ${fmtTs(crit.confirmedAt)}` : "proposed",
    refinement, "what done means for this row — under Refinement");
  read.prepend(arrived);
  if (brief) request.appendChild(el("div", "rvhead", "your draft, as filed"));
  if (body) qTextBlock(request, brief ? "your draft" : "request", body);
  else request.appendChild(el("div", "hint shellhint", "loading the prompt text…"));
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
  // an act in the rail's list says in one line what it DOES (owner, 2026-09-19: „[Zitat entfernt]“
  // ). The main act has its own why-line.
  const place = (node: HTMLElement, act: QMainAct, desc?: string): void => {
    if (desc && !isMain(act)) qActDesc(node, desc);
    (isMain(act) ? mainBox : acts).appendChild(node);
  };
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
  // MORE OPTIONS (owner, 2026-09-18: „[Zitat entfernt]“): the buttons stay in view; the
  // settings that shape HOW a row runs — kind, agent, review — fold under one summary. It opens by
  // itself when the agent pick blocks a start, so a disabled button never hides its reason.
  const more = document.createElement("details");
  more.className = "qmore";
  more.appendChild(el("summary", "", "More options — kind, agent, review"));
  more.appendChild(kindRow);
  if (qAdvisory(t)) more.open = true; // for a note, its Kind IS the next decision

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
    // Until 2026-09-10 „[Zitat entfernt]“ meant „[Zitat entfernt]“. The analyst is retired,
    // so this is re-grounded on the fact that outlived it — WHICH BYTES the lane gets — rather than
    // left standing as a flag that would now be true of every row and therefore say nothing.
    // WHAT the lane would start AS, before either act below: the harness/model/effort pickers, the
    // effective triple with its origins, and the server's refusal if the combination cannot run.
    // Both acts read the same pick (qSpawnPick) at click time and stay disabled while it is blocked.
    const spawnProblem = startable ? qSpawnStateOf(t.id).problem : null;
    if (startable) {
      more.appendChild(qSpawnRow(t.id));
      if (spawnProblem) more.open = true;
    }
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
        : raw ? "a raw start — tick the line below to confirm it; clarify settles the criterion first"
          : "opens a lane on the triple shown above and hands it the brief";
      sb.onclick = () => void qAct(t.id, "dispatch",
        qDispatchBody("start", qSpawnPick.get(t.id) ?? Q_SPAWN_EMPTY, raw));
      place(sb, "start", "opens a lane on it now — the dispatcher is not asked");
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
    // before writing code. The standing answer to a „[Zitat entfernt]“ blocker.
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
      place(cb, "clarify", "a lane settles with you what done means, then waits — no code yet");
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
          : "No brief — the raw request will be sent."));
      release.appendChild(b);
      place(release, "release");
    }
    if (t.status === "queued")
      acts.appendChild(qActDesc(mk("hold", "unqueue"), "takes it back out of the release order, to pending"));
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
    more.appendChild(g);
  }
  // the ends of a row — restore, done, archive — leave the rail's first screen for its ⋯ fold
  const ends = el("div", "pkdacts");
  if (t.status === "archived") ends.appendChild(mk("restore", "unarchive"));
  if (t.status !== "done" && t.status !== "archived") ends.appendChild(mk("done", "done"));
  if (t.status !== "sent" && t.status !== "archived") ends.appendChild(mk("🗄 archive", "archive"));
  rail.appendChild(acts);
  rail.appendChild(more);
  rail.appendChild(headFacts);
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
  // ⋯ THE ENDS AND THE DANGER ZONE: folded and last in the rail, so ✕ delete, the one irreversible
  // act on this pane, is never a neighbour of the main action — the hint line sits between it and
  // the reversible ends.
  const danger = qDetailSection(rail, "⋯ done · archive · delete", true, false);
  if (ends.childElementCount) danger.appendChild(ends);
  const dangerActs = el("div", "pkdacts");
  // the one irreversible act on this pane asks first — through the dialog helper (G4.5), never
  // the browser's confirm() (the inventory's measured error 2: it used to fire qAct directly)
  const del = el("button", "shrbtn danger", "✕ delete") as HTMLButtonElement;
  del.onclick = async () => {
    const ok = await askRisk({
      title: `Delete task ${t.id} for good?`,
      body: [el("div", "bmidrun", "there is no restore — the row and its thread are dropped. 🗄 archive keeps it.")],
      buttons: [
        { label: "cancel", value: false },
        { label: "✕ delete", danger: true, value: true },
      ],
    });
    if (ok) void qAct(t.id, "delete");
  };
  dangerActs.appendChild(del);
  danger.appendChild(el("div", "hint shellhint",
    "deleting drops the row and its thread for good — there is no restore. 🗄 archive keeps it."));
  danger.appendChild(dangerActs);
  restoreFocus();
}

export function qSelect(id: string | null) {
  // a selection change orphans an in-flight founding POST even when it does not reset the draft
  // (selecting a task, or a program whose pane returns before the draft block ever runs)
  if (id !== qPick) qBsSeq++;
  qPick = id;
  qKey = ""; // selection is painted on the rows, so they must be rebuilt
  renderQueue();
  renderQueueDetail();
  qShell?.showDetail(true);
}

export const Q_NO_PROGRAM = "-";
// a lane worktree (`<repo>.worktrees/<name>`) is its repo, not a project of its own
export const qRepoRoot = (path: string): string => path.replace(/\/+$/, "").replace(/\.worktrees\/[^/]+$/, "");
export const qTaskRepo = (t: TaskInfo): string | null => {
  const r = t.repo ?? (dispatch.repo || null);
  return r ? qRepoRoot(r) : null;
};
export function qProgramRepos(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const t of tasksList) {
    const r = qTaskRepo(t);
    if (!t.programId || !r) continue;
    out.set(t.programId, (out.get(t.programId) ?? new Set()).add(r));
  }
  return out;
}
export const Q_NO_REPO = "-";
export const qInRepo = (t: TaskInfo): boolean => !qRepo || (qTaskRepo(t) ?? Q_NO_REPO) === qRepo;
export const qInScope = (t: TaskInfo): boolean => qInRepo(t)
  && (!qProg || (qProg === Q_NO_PROGRAM ? !t.programId : t.programId === qProg));

// The scope, in one of two shapes over the same two variables (qRepo, qProg). Counts are OPEN rows,
// so a project says how much is on its desk. Programs are offered in Work only, and — in the tree —
// under the chosen repo only, because a program belongs to the repos its own tasks target.
export function paintQueueScope() {
  const bar = qScopeBar;
  const tree = qTree;
  if (!bar || !tree) return;
  bar.replaceChildren();
  tree.replaceChildren();
  const asTree = qTreeOn && !MOBILE_MQ.matches;
  tree.hidden = !asTree;
  if (qLayoutBtn) {
    qLayoutBtn.textContent = asTree ? "⇤ line" : "⇥ tree";
    qLayoutBtn.title = asTree ? "fold the project tree into one picker in this line"
      : "show projects and their programs as a tree beside the list";
  }
  const open = tasksList.filter((t) => !qClosed(t));
  const repos = new Map<string, number>();
  for (const t of open) {
    const r = qTaskRepo(t) ?? Q_NO_REPO;
    repos.set(r, (repos.get(r) ?? 0) + 1);
  }
  const repoList = [...repos].sort((a, b) => b[1] - a[1]);
  const repoLabel = (r: string) => r === Q_NO_REPO ? "no repo" : baseName(r);
  const repoTitle = (r: string) => r === Q_NO_REPO
    ? "rows naming no target repo while the dispatcher has none either — where they would run is unknown" : r;
  const progsOf = (repo: string): [string, number][] => {
    const progs = new Map<string, number>();
    for (const t of open) {
      if ((qTaskRepo(t) ?? Q_NO_REPO) !== repo) continue;
      const k = t.programId ?? Q_NO_PROGRAM;
      progs.set(k, (progs.get(k) ?? 0) + 1);
    }
    return [...progs].sort((a, b) => b[1] - a[1]);
  };
  const progLabel = (k: string) => {
    const p = programsList.find((x) => x.id === k);
    return k === Q_NO_PROGRAM ? "no program" : p ? qProgramShort(p.title) : k.slice(0, 8);
  };
  const choose = (repo: string | null, prog: string | null) => {
    qRepo = repo; qProg = prog; qSel.clear(); qKey = ""; renderQueue();
  };
  if (asTree) {
    tree.setAttribute("aria-label", "Project and program");
    const node = (label: string, n: number, on: boolean, cls: string, act: () => void, title: string) => {
      const b = el("button", `qtreen ${cls}${on ? " on" : ""}`) as HTMLButtonElement;
      b.type = "button";
      b.append(el("span", "qtreel", label), el("span", "qtabn", String(n)));
      b.title = title;
      b.setAttribute("aria-pressed", String(on));
      b.onclick = act;
      tree.appendChild(b);
      return b;
    };
    node("All", open.length, qRepo === null, "all", () => choose(null, null), "every project");
    for (const [r, n] of repoList) {
      const chosen = qRepo === r;
      const b = node(`${chosen ? "▾" : "▸"} ${repoLabel(r)}`, n, chosen && !qProg, "repo", () => choose(r, null), repoTitle(r));
      // THE REPO SHEET (K2): a second affordance on the node, beside the scoping click — the sheet
      // is a READ of one repo's layers (GET /api/repos/:canon/view), not a scope change, so it is
      // its own click target and writes qPick only. A fake key ("no repo") opens nothing.
      if (r !== Q_NO_REPO) {
        const sheet = el("span", "qtabn", "▤");
        sheet.title = `open the repo sheet — this repo's layers on demand (GET /api/repos/:canon/view)`;
        sheet.onclick = (e) => {
          e.stopPropagation();
          qPick = `repo:${r}`;
          qDetailKey = "";
          renderQueueDetail();
        };
        b.appendChild(sheet);
      }
      if (!chosen || qView !== "work") continue;
      const progs = progsOf(r);
      if (progs.length < 2 && !qProg) continue;
      for (const [k, pn] of progs)
        node(progLabel(k), pn, qProg === k, "prog", () => choose(r, k),
          k === Q_NO_PROGRAM ? "rows of this repo bound to no program" : `program ${k}`);
    }
    return;
  }
  // THE LINE: one picker, "repo / program". The value carries both halves, split on the first "\n".
  const sel = el("select", "qprogsel qscopesel") as HTMLSelectElement;
  sel.setAttribute("aria-label", "Project and program");
  const opt = (parent: HTMLElement, repo: string, prog: string, label: string) => {
    const o = el("option", "", label) as HTMLOptionElement;
    o.value = `${repo}\n${prog}`;
    parent.appendChild(o);
  };
  opt(sel, "", "", `all projects · ${open.length}`);
  for (const [r, n] of repoList) {
    const group = el("optgroup", "") as HTMLOptGroupElement;
    group.label = repoLabel(r);
    opt(group, r, "", `${repoLabel(r)} · ${n}`);
    if (qView === "work") {
      const progs = progsOf(r);
      if (progs.length > 1 || (qRepo === r && qProg)) for (const [k, pn] of progs)
        opt(group, r, k, `${repoLabel(r)} / ${progLabel(k)} · ${pn}`);
    }
    sel.appendChild(group);
  }
  sel.value = `${qRepo ?? ""}\n${qProg ?? ""}`;
  sel.onchange = () => {
    const [r, k] = sel.value.split("\n");
    choose(r || null, k || null);
  };
  bar.appendChild(sel);
}

// THE NOTES, AGGREGATED (owner, 2026-09-19: „[Zitat entfernt]“
// ). Open advisory rows only, counted
// by the fields the poll carries — kind, source, program, age, and whether a task has taken the
// note as a source. Nothing is inferred from the prose: a theme this cannot read is not drawn.
export const Q_NOTE_AGES: { label: string; maxMs: number }[] = [
  { label: "< 1 d", maxMs: 864e5 }, { label: "1–3 d", maxMs: 3 * 864e5 }, { label: "3–7 d", maxMs: 7 * 864e5 },
  { label: "1–2 w", maxMs: 14 * 864e5 }, { label: "older", maxMs: Infinity },
];
export interface QNotesAgg {
  total: number; notiz: number; richtung: number; other: number; fromMain: number; attached: number;
  programs: { id: string; title: string; notiz: number; richtung: number; other: number; total: number }[];
  ages: { label: string; notiz: number; richtung: number; other: number; total: number }[];
}
export function qNotesAggregate(notes: readonly TaskInfo[], programs: readonly ProgramInfo[], attached: ReadonlySet<string>,
  now: number): QNotesAgg {
  const kindOf = (t: TaskInfo): "notiz" | "richtung" | "other" =>
    t.kind === "notiz" ? "notiz" : t.kind === "richtung" ? "richtung" : "other";
  const progs = new Map<string, QNotesAgg["programs"][number]>();
  const ages = Q_NOTE_AGES.map((a) => ({ label: a.label, notiz: 0, richtung: 0, other: 0, total: 0 }));
  const agg: QNotesAgg = { total: 0, notiz: 0, richtung: 0, other: 0, fromMain: 0, attached: 0, programs: [], ages };
  for (const t of notes) {
    const k = kindOf(t);
    agg.total++; agg[k]++;
    if (t.source === "main") agg.fromMain++;
    if (attached.has(t.id)) agg.attached++;
    const pid = t.programId ?? Q_NO_PROGRAM;
    const p = progs.get(pid) ?? { id: pid, title: pid === Q_NO_PROGRAM ? "no program"
      : programs.find((x) => x.id === pid)?.title ?? pid, notiz: 0, richtung: 0, other: 0, total: 0 };
    p[k]++; p.total++;
    progs.set(pid, p);
    const age = Math.max(0, now - t.created);
    const bin = ages[Q_NOTE_AGES.findIndex((a) => age < a.maxMs)];
    bin[k]++; bin.total++;
  }
  agg.programs = [...progs.values()].sort((a, b) => b.total - a.total || a.title.localeCompare(b.title));
  return agg;
}
// the notes some open auftrag names as a source (its pins ride GET /api/tasks; before that read
// lands, none are known and every note counts as loose)
export function qAttachedNoteIds(): Set<string> {
  const out = new Set<string>();
  for (const t of tasksList) if (!qAdvisory(t) && !qClosed(t))
    for (const pin of taskNotesFull.get(t.id) ?? []) out.add(pin.noteId);
  return out;
}
// the overview in the detail pane: counts, a stacked bar per program, and the age histogram. Two
// inks for the two kinds; a bar is as long as its share of the largest group, and every number is
// written beside what it measures, so the picture never has to be read without its figures.
export function qPaintNotesOverview(parent: HTMLElement, agg: QNotesAgg, jump: (programId: string) => void): void {
  parent.appendChild(el("div", "qdtitle-t", `Notes · ${agg.total} open`));
  parent.appendChild(el("div", "qnsub", "Observations and direction no task has turned into work yet."
    + " A note joins a task as a source; changing its Kind to auftrag makes it work of its own."));
  const kpis = el("div", "qnkpis");
  const kpi = (n: number, label: string, cls = "") => {
    const b = el("div", `qnkpi${cls ? ` ${cls}` : ""}`);
    b.append(el("div", "qnkpin", String(n)), el("div", "qnkpil", label));
    kpis.appendChild(b);
  };
  kpi(agg.notiz, "notiz", "k-notiz");
  kpi(agg.richtung, "richtung", "k-richtung");
  if (agg.other) kpi(agg.other, "other advisory", "k-other");
  kpi(agg.fromMain, "from MAINs");
  kpi(agg.attached, "attached to a task");
  parent.appendChild(kpis);
  if (!agg.total) return;
  const legend = el("div", "qnlegend");
  for (const [k, label] of [["notiz", "notiz"], ["richtung", "richtung"], ...(agg.other ? [["other", "other"]] : [])])
    legend.append(el("span", `qnsw k-${k}`), el("span", "", label));
  parent.appendChild(el("div", "qnhead", "by program"));
  parent.appendChild(legend);
  const max = Math.max(...agg.programs.map((p) => p.total));
  const bars = el("div", "qnbars");
  for (const p of agg.programs) {
    const row = el("button", "qnbar") as HTMLButtonElement;
    row.type = "button";
    row.title = `${p.title}: ${p.notiz} notiz · ${p.richtung} richtung${p.other ? ` · ${p.other} other` : ""} — show them in the list`;
    row.onclick = () => jump(p.id);
    const track = el("span", "qnbartrack");
    const fill = el("span", "qnbarfill");
    fill.style.width = `${Math.round((p.total / max) * 100)}%`;
    for (const k of ["notiz", "richtung", "other"] as const) if (p[k]) {
      const seg = el("span", `qnseg k-${k}`);
      seg.style.flexGrow = String(p[k]);
      fill.appendChild(seg);
    }
    track.appendChild(fill);
    row.append(el("span", "qnbarl", p.title), track, el("span", "qnbarn", String(p.total)));
    bars.appendChild(row);
  }
  parent.appendChild(bars);
  parent.appendChild(el("div", "qnhead", "by age"));
  const hmax = Math.max(...agg.ages.map((a) => a.total), 1);
  const hist = el("div", "qnhist");
  for (const a of agg.ages) {
    const col = el("div", "qnhcol");
    col.title = `${a.label}: ${a.total} (${a.notiz} notiz · ${a.richtung} richtung${a.other ? ` · ${a.other} other` : ""})`;
    const stack = el("div", "qnhstack");
    stack.style.height = `${Math.round((a.total / hmax) * 100)}%`;
    for (const k of ["other", "richtung", "notiz"] as const) if (a[k]) {
      const seg = el("span", `qnseg k-${k}`);
      seg.style.flexGrow = String(a[k]);
      stack.appendChild(seg);
    }
    const plot = el("div", "qnhplot");
    plot.appendChild(stack);
    col.append(el("div", "qnhn", String(a.total)), plot, el("div", "qnhl", a.label));
    hist.appendChild(col);
  }
  parent.appendChild(hist);
}

export function renderQueue() {
  const shell = qShell;
  if (!shell || !shell.isOpen()) return;
  qFootPaint?.();
  void loadTaskTexts(); // no-op unless the visible task set changed
  void loadPrograms();  // no-op unless the poll's digest moved or the floor elapsed
  if (qView === "waves") void loadBundles(); // no-op unless a task fact the proposal reads moved
  if (qView === "konzepte") void loadKonzepte(); // no-op inside its floor
  const scoped = tasksList.filter(qInScope);
  const model = qTaskListModel(scoped, taskText, programsList, qQuery);
  const shown = model.work;
  const laneJoins = qLaneJoins(tasksList, fleet, dispatch.repo, serverNow);
  // REBUILD ONLY ON CHANGE. Without this the 2 s poll would rebuild the list under the cursor and
  // reset the selection every two seconds — the same class of defect as the compose box above.
  const now = Date.now();
  const key = JSON.stringify([qView, qPick, qQuery, qProgDone, dispatch.on, dispatch.available,
    Math.floor(now / 60000), qView === "waves" ? qWaveProjectionKey() : null,
    // the wave caveat's acknowledgment is a RENDER INPUT of this list, unlike qRawAck which lives
    // in the detail pane: without it here the checkbox flips, renderQueue is called, the key has
    // not moved, and the early return below leaves the button it unlocks disabled.
    qView === "waves" ? qWaveAck : null,
    qView === "waves" ? [qBundlesRead, qBundles] : null,
    qView === "konzepte" ? [konzepteRead, konzepteKey] : null,
    // the lane line is derived from the slots too — a lane going idle or dirty moves no task field
    qLaneKey(laneJoins),
    // the MARK is derived from the slots, so it moves without any program field moving. Leaving
    // it out of the key would freeze a MAIN at `live` for as long as no task changed.
    programsRead, programsStale,
    programsList.map((p) => [p.id, p.status, p.title, programMark(p).mark]),
    [...model.work, ...model.history].map((t) => [t.id, t.status, t.slot, t.note, t.kind, t.briefAt,
      t.criterion ? t.criterion.confirmedAt === null : null, taskText.has(t.id),
      t.comments?.n, t.notes?.at, t.hold?.at, t.size, t.programId]),
    qNotesOpen, taskTextKey, [...taskAbsorbedFull], [...taskDispositionFull], qRepo, qProg, [...qSel], qBundleBusy, qBundleMode]);
  if (key === qKey) return;
  qKey = key;
  paintQueueScope();

  // Each primary view names only its own domain. Waves keeps its weaker advisory claim and counts
  // everything deliberately kept outside; Work's counts stay global while a search narrows rows.
  const projection = qView === "waves" ? qWaveProjection() : null;
  if (qView === "work") {
    const n = (g: QGroup) => scoped.filter((t) => qGroupOf(t) === g).length;
    const held = scoped.filter((t) => !qClosed(t) && t.hold).length;
    shell.setSubtitle([`${n("running")} running`, `${n("released")} released`, `${n("needs")} need you`,
      `${n("backlog")} backlog`, `${n("notes")} notes`, held ? `⏸ ${held} held` : ""].filter(Boolean).join(" · "));
  } else if (qView === "notes") {
    const notes = scoped.filter((t) => qGroupOf(t) === "notes");
    const richtung = notes.filter((t) => t.kind === "richtung").length;
    shell.setSubtitle(`${notes.length} open note${notes.length === 1 ? "" : "s"} · ${richtung} richtung`
      + ` · ${notes.filter((t) => t.source === "main").length} from MAINs`);
  } else if (qView === "programs") {
    shell.setSubtitle(programsRead === "fail" ? "Programs unavailable — the last read failed"
      : `${programsList.length} program${programsList.length === 1 ? "" : "s"}`
        + (programsStale > 0 ? ` · ${programsStale} stale active` : ""));
  } else if (qView === "konzepte") {
    const offen = konzepteIndex.reduce((n, k) => n + k.anmerkungen.offen, 0);
    shell.setSubtitle(konzepteRead === "fail" ? "Konzepte nicht lesbar — der letzte Abruf scheiterte"
      : `${konzepteIndex.length} Konzept${konzepteIndex.length === 1 ? "" : "e"} · ${offen} offene Anmerkung${offen === 1 ? "" : "en"}`);
  } else if (qView === "history") {
    const count = scoped.filter(qClosed).length;
    shell.setSubtitle(`${count} done or archived task${count === 1 ? "" : "s"}`);
  } else if (projection) {
    const placed = projection.repos.reduce((n, repo) =>
      n + repo.waves.reduce((m, wave) => m + wave.tasks.length, 0), 0);
    shell.setSubtitle(`${placed} with no known collision · ${projection.unresolved.length} unresolved outside`);
  }

  perfRebuild("renderQueue");
  shell.list.replaceChildren();
  const rows: ShellRow[] = [];
  let selIdx = -1;
  qRowId = new Map();
  const add = (o: { name: string; chips?: QChip[]; age?: QChip; cls?: string; id: string | null;
    sub?: HTMLElement | null; pick?: string | null }) => {
    const r = el("div", `shellrow${o.cls ? ` ${o.cls}` : ""}`);
    qRowId.set(r, o.id);
    // in bundle mode a click MARKS a bundlable row; a row that cannot join says why and stays inert
    const markId = qBundleMode && o.pick !== undefined && o.id ? o.id : null;
    if (markId) {
      r.classList.add(o.pick === null ? "q-markable" : "q-unmarkable");
      if (qSel.has(markId)) r.classList.add("q-marked");
      r.title = o.pick ?? (qSel.has(markId) ? "marked — click to unmark" : "click to mark for the bundle");
    } else if (qBundleMode) r.classList.add("q-unmarkable");
    const m = el("div", "shrmain");
    const name = el("div", "qrowhead");
    name.appendChild(el("div", "shrname", o.name));
    if (o.age) {
      const age = el("span", "qage", o.age.text);
      if (o.age.title) age.title = o.age.title;
      name.appendChild(age);
    }
    m.appendChild(name);
    if (o.chips?.length) {
      const chips = el("div", "qchips");
      for (const c of o.chips) {
        const chip = el("span", `qchip qc-${c.cls.split(" ").join(" qc-")}`, c.text);
        if (c.title) chip.title = c.title;
        chips.appendChild(chip);
      }
      m.appendChild(chips);
    }
    if (o.sub) m.appendChild(o.sub);
    r.appendChild(m);
    const act = markId
      ? () => {
        if (o.pick !== null) return;
        if (qSel.has(markId)) qSel.delete(markId); else qSel.add(markId);
        qKey = ""; renderQueue(); renderQueueDetail();
      }
      : () => { if (!qBundleMode) qSelect(o.id); };
    r.onclick = act;
    shell.list.appendChild(r);
    if (o.id === qPick) { r.classList.add("sel"); selIdx = rows.length; }
    rows.push({ el: r, open: act });
  };

  // a note ASSIGNED to an open task is drawn under that task, never also loose in Notes: one row,
  // one place. The pins ride GET /api/tasks, so until that read lands every note stays loose.
  const byId = new Map(tasksList.map((t) => [t.id, t]));
  const pinnedUnder = new Map<string, TaskInfo[]>();
  for (const t of model.work) {
    if (qAdvisory(t)) continue;
    const notes = (taskNotesFull.get(t.id) ?? []).map((pin) => byId.get(pin.noteId))
      .filter((n): n is TaskInfo => !!n && !qClosed(n));
    if (notes.length) pinnedUnder.set(t.id, notes);
  }
  const assigned = new Set([...pinnedUnder.values()].flat().map((n) => n.id));
  const addTask = (t: TaskInfo) => {
    const summary = qTaskSummary(t, qTaskText(t.id), now, programsList);
    const sources = qBundleSources(qTaskText(t.id));
    if (t.status === "archived") {
      const into = tasksList.filter((target) => absorbedTaskIds(target.id, [{ id: t.id, status: t.status,
        disposition: taskDispositionFull.get(t.id) }]).includes(t.id));
      for (const target of into) summary.chips.push({ text: `aufgegangen in ${target.id}`, cls: "bundle" });
    }
    if (sources.length) summary.chips.unshift({ text: `⧉ ${sources.length}`, cls: "bundle",
      title: `bundle of ${sources.join(", ")}` });
    add({
      name: summary.title, chips: summary.chips, age: summary.age, id: t.id,
      pick: qClosed(t) || t.status === "sent" || qAdvisory(t) ? undefined : qBundleRefusal(t),
      sub: qLaneLine(laneJoins.get(t.id) ?? { kind: "none" }),
      cls: [`q-${t.status}`, qAdvisory(t) ? "q-obs" : "", t.hold ? "q-held" : ""].filter(Boolean).join(" "),
    });
    for (const id of taskAbsorbedFull.get(t.id) ?? []) {
      add({ name: `↳ aufgegangen: ${id} · ${qFirstLine(qTaskText(id))}`, id, cls: "qchild q-archived", chips: [] });
    }
    for (const n of pinnedUnder.get(t.id) ?? []) {
      add({ name: `↳ ${qFirstLine(qTaskText(n.id))}`, id: n.id, cls: "qchild q-obs",
        chips: [{ text: n.kind ?? "notiz", cls: "kind" }] });
    }
  };
  const addSection = (name: string, count: number, hint: string, visibleHint = false) => {
    const head = el("div", "shellsec");
    head.appendChild(el("span", "shellsect", name));
    head.appendChild(el("span", "shellsecn", String(count)));
    head.title = hint;
    shell.list.appendChild(head);
    if (visibleHint) shell.list.appendChild(el("div", "hint qwavehint", hint));
    return head;
  };

  let visibleRows = 0;
  if (qView === "programs") {
    const progRepos = qProgramRepos();
    const progMatch = programsList.filter((p) => !qRepo || progRepos.get(p.id)?.has(qRepo)).filter((p) => !qQuery
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
          chips: [{ text: `MAIN ${mark}`, cls: mark === "live" ? "run" : "need" }, { text: p.status, cls: "kind" },
            ...(p.main && typeof p.main.slot === "number" ? [{ text: `slot ${p.main.slot}`, cls: "prog" }] : [])],
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
  } else if (qView === "notes") {
    const notes = model.work.filter((t) => qGroupOf(t) === "notes");
    const byProg = new Map<string, TaskInfo[]>();
    for (const t of notes) {
      const pid = t.programId ?? Q_NO_PROGRAM;
      byProg.set(pid, [...(byProg.get(pid) ?? []), t]);
    }
    const order = [...byProg.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [pid, rowsOf] of order) {
      const title = pid === Q_NO_PROGRAM ? "no program" : programsList.find((x) => x.id === pid)?.title ?? pid;
      const head = addSection(title, rowsOf.length, "open notes of this program, newest first");
      head.dataset.prog = pid;
      for (const t of [...rowsOf].sort((a, b) => b.created - a.created)) { addTask(t); visibleRows++; }
    }
    if (!visibleRows) shell.list.appendChild(el("div", "pknone",
      qQuery ? "no notes match this search" : "no open notes — nothing is waiting to be read"));
  } else if (qView === "konzepte") {
    if (konzepteRead === "fail") shell.list.appendChild(el("div", "pknone", konzepteErr ?? "GET /api/konzepte did not answer"));
    const shownK = konzepteIndex.filter((k) => !qQuery || k.konzept.includes(qQuery)
      || (k.letzte?.anlass ?? "").toLowerCase().includes(qQuery) || (k.letzte?.geltung ?? "").toLowerCase().includes(qQuery));
    if (shownK.length) addSection("Konzepte", shownK.length,
      "jedes Konzept unter der privaten Konzeptwurzel (FLEET_KONZEPT_ROOT) mit seiner letzten Version —"
      + " nur Metadaten; der Inhalt einer Fassung wird hier nie gezeigt");
    for (const k of shownK) {
      const v = k.letzte;
      const sub = el("div", "hint shellhint", v
        ? `v${v.version} · ${fmtTs(v.at)} · ${konzeptWho(v.actor)}` : "noch keine Version veroeffentlicht");
      add({ name: k.konzept, id: `konz:${k.konzept}`, sub, cls: k.anmerkungen.offen ? "" : "q-obs",
        chips: [
          ...(v ? [{ text: `v${v.version}`, cls: "kind", title: `${k.versionen} Version${k.versionen === 1 ? "" : "en"}` },
            { text: v.ebene, cls: "prog", title: `Ebene · gilt: ${v.geltung}` }] : []),
          ...(k.anmerkungen.offen ? [{ text: `💬 ${k.anmerkungen.offen} offen`, cls: "need",
            title: `${k.anmerkungen.offen} offen · ${k.anmerkungen.eingearbeitet} eingearbeitet · ${k.anmerkungen.verworfen} verworfen` }] : []),
          ...(k.malformed ? [{ text: `⚠ ${k.malformed}`, cls: "need", title: `${k.malformed} unlesbare Ledger-Zeile(n)` }] : []),
        ] });
      visibleRows++;
    }
    if (!visibleRows && konzepteRead !== "fail") shell.list.appendChild(el("div", "pknone",
      konzepteRead === "unread" ? "lese GET /api/konzepte …"
        : qQuery ? "kein Konzept passt zu dieser Suche" : "keine Konzepte unter der Konzeptwurzel"));
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
    for (const id of [...qSel]) if (!model.work.some((t) => t.id === id)) qSel.delete(id);
    if (!qQuery && !qBundleMode) add({ name: "＋ New task", cls: "qnew", id: null });
    // BUNDLE SUGGESTIONS, from the land-wave sensor (task-land-waves.ts): rows in one program on a
    // shared confirmed surface. Drawn above Backlog because that is where their rows are, and
    // offered as a TICK, never an act — whether they belong together is the owner's judgment.
    const suggest = qLandWaveProjection().repos.flatMap((repo) => repo.waves)
      .filter((w) => w.ids.length > 1 && w.ids.every((id) => model.work.some((t) => t.id === id)))
      .filter((w) => w.ids.every((id) => { const t = tasksList.find((x) => x.id === id); return !!t && !qBundleRefusal(t); }));
    if (qBundleBtn) {
      qBundleBtn.textContent = qBundleMode ? "✓ done bundling" : `⧉ Bundle${suggest.length ? ` · ${suggest.length}` : ""}`;
      qBundleBtn.classList.toggle("on", qBundleMode);
      qBundleBtn.title = qBundleMode ? "leave bundle mode — clicks open rows again"
        : `mark rows to bundle into one${suggest.length ? `; ${suggest.length} suggested by the land-wave sensor` : ""}`;
    }
    for (const g of Q_GROUPS) {
      if (g.k === "backlog" && suggest.length && !qQuery && qBundleMode) {
        addSection("Suggested bundles", suggest.length, "rows of one program on a shared confirmed file surface —"
          + " one lane and one land instead of several. Structural only: nothing checked that they share a cause.");
        for (const w of suggest) {
          const line = el("div", "qsuggest");
          line.appendChild(el("div", "qsuggestt", w.ids.map((id) => qFirstLine(qTaskText(id)).slice(0, 48)).join("  +  ")));
          line.appendChild(el("div", "qsuggestf", [`${w.ids.length} rows`, w.klasse,
            `~${Math.round(w.savingsSec / 60)} min saved`, w.sharedFiles.length ? `shared: ${w.sharedFiles.slice(0, 3).join(", ")}` : ""]
            .filter(Boolean).join(" · ")));
          const go = el("button", "shrbtn", "⧉ bundle these") as HTMLButtonElement;
          go.disabled = qBundleBusy;
          go.title = "one row from these; ⧉ auflösen on the bundle brings them back";
          go.onclick = () => void qMakeBundle(w.ids);
          line.appendChild(go);
          shell.list.appendChild(line);
        }
      }
      const group = model.work.filter((t) => qGroupOf(t) === g.k && !assigned.has(t.id));
      // Running is the top of the pipeline and always drawn: an empty top is a fact, not a gap
      if (g.k === "running" && !group.length && !qQuery) {
        addSection(g.head, 0, g.hint);
        shell.list.appendChild(el("div", "qempty", "nothing running"));
        continue;
      }
      if (!group.length) continue;
      const head = addSection(g.head, group.length, g.hint);
      if (g.k === "notes" && !qQuery) {
        // folded by default: advisory rows are input to the pipeline, not a stage of it
        head.classList.add("qfoldhead");
        // the notes have a view of their own now (Notes); this head points there, the fold stays
        // for a quick look
        head.insertBefore(el("span", "qfoldmark", qNotesOpen ? "▾" : "▸"), head.firstChild);
        head.onclick = () => { qNotesOpen = !qNotesOpen; renderQueue(); };
        const go = el("button", "qnotesgo", "open Notes →") as HTMLButtonElement;
        go.type = "button";
        go.title = "the notes aggregated by program and age, with every open note listed";
        go.onclick = (ev) => { ev.stopPropagation(); qChooseView?.("notes"); };
        head.appendChild(go);
        if (!qNotesOpen) { visibleRows += group.length; continue; }
      }
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
    if (qBundleMode) {
      const bar = el("div", "qselbar");
      bar.appendChild(el("span", "qseln", qSel.size ? `${qSel.size} marked` : "click rows to mark them"));
      const draft = qSel.size > 1 ? qBundleDraft([...qSel]) : "mark at least two rows";
      const make = el("button", "shrbtn qselgo", qBundleBusy ? "bundling…" : "⧉ bundle") as HTMLButtonElement;
      make.disabled = typeof draft === "string" || qBundleBusy;
      make.title = typeof draft === "string" ? draft
        : "one new row carrying every marked text; the marked rows are archived as \"gebündelt in <id>\" — ⧉ auflösen brings them back";
      make.onclick = () => void qMakeBundle([...qSel]);
      bar.appendChild(make);
      if (qSel.size) {
        const clear = el("button", "shrbtn", "clear") as HTMLButtonElement;
        clear.onclick = () => { qSel.clear(); qKey = ""; renderQueue(); renderQueueDetail(); };
        bar.appendChild(clear);
      }
      if (typeof draft === "string" && qSel.size > 1) bar.appendChild(el("span", "qselwhy", draft));
      shell.list.appendChild(bar);
    }
    if (!visibleRows) shell.list.appendChild(el("div", "pknone", qQuery
      ? "no tasks match this search"
      : `Work is clear — no open tasks.${model.history.length
        ? ` Choose History to inspect ${model.history.length} done or archived task${model.history.length === 1 ? "" : "s"}.`
        : ""}`));
  } else if (projection) {
    qRenderBundles(shell.list, addSection);
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
        const line = el("div", "hint qwavehint qwaveland",
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



export function openQueue() {
  setDrawer(false);
  qShell?.close();
  qPick = null;
  qQuery = "";
  qView = "work";
  qProgDone = false;
  qNotesOpen = false;
  qRepo = null;
  qProg = null;
  qSel.clear();
  qBundleMode = false;
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
    listWidth: 360,
    onSelect: (row) => { if (qRowId.has(row.el)) qSelect(qRowId.get(row.el) ?? null); },
    onClose: () => {
      qScopeBar = null; qTree = null; qLayoutBtn = null; qBundleBtn = null; qBundleMode = false;
      qShell = null; qCompose = null; qRepoIn = null; qProgSel = null; qCmBox = null; qCmFor = null;
      qBriefDraft = null; qCriterionDraft = null; qRawAck = null; qWaveAck = null; qRowId = new Map();
      qSpawnPick.clear(); qSpawnUi = null;
      qBsFor = null; qBsCwd = null; qBsLabel = null; qBsErr = null; qBsBusy = false; qBsSeq++;
    },
  });
  qShell = shell;

  const view = el("div", "tabrow qview");
  view.setAttribute("role", "group");
  view.setAttribute("aria-label", "Task queue views");
  const views = ([
    ["work", "Work"], ["notes", "Notes"], ["programs", "Programs"], ["history", "History"], ["waves", "Waves"],
    ["konzepte", "Konzepte"],
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
    if (next !== "work") { qBundleMode = false; qSel.clear(); }
    if (next === "waves") void loadBundles(true);
    if (next === "konzepte") { konzeptFull.clear(); void loadKonzepte(true); }
    qPick = null;
    qRawAck = null;
    qKey = "";
    qDetailKey = "";
    paintView();
    renderQueue();
    renderQueueDetail();
  };
  for (const item of views) item.button.onclick = () => chooseView(item.id);
  qChooseView = chooseView;
  view.append(...views.map((item) => item.button));
  paintView();
  // the line reads scope → search → views → bundle → layout; in the tree layout the scope is empty
  qScopeBar = el("div", "qscope");
  shell.tools.appendChild(qScopeBar);
  qTree = el("nav", "qtree");
  shell.list.before(qTree);
  const layoutBtn = el("button", "shrbtn qlayoutbtn") as HTMLButtonElement;
  layoutBtn.type = "button";
  layoutBtn.onclick = () => {
    qTreeOn = !qTreeOn;
    prefSet("fleet.queue.scope", qTreeOn ? "tree" : "line");
    qKey = ""; renderQueue();
  };
  qLayoutBtn = layoutBtn;

  const search = el("input", "pkfilterin") as HTMLInputElement;
  search.type = "text";
  search.spellcheck = false;
  search.placeholder = "search tasks — text, ID, status, repo or program";
  search.setAttribute("aria-label", "Search tasks by text, ID, status, repository or program");
  search.addEventListener("input", () => { qQuery = search.value.trim().toLowerCase(); qKey = ""; renderQueue(); });
  shell.tools.appendChild(search);
  shell.tools.appendChild(view);
  const bundleBtn = el("button", "shrbtn qbundlebtn", "⧉ Bundle") as HTMLButtonElement;
  bundleBtn.type = "button";
  bundleBtn.onclick = () => {
    qBundleMode = !qBundleMode;
    qSel.clear();
    if (qBundleMode && qView !== "work") chooseView("work");
    qKey = ""; renderQueue(); renderQueueDetail();
  };
  qBundleBtn = bundleBtn;
  // one card for the whole detail pane — the pane node survives every repaint, its children do not
  attachEntityCards(shell.detail, describeEntity);
  // and one for the list, where only the Waves bundle ids carry data-ent
  attachEntityCards(shell.list, describeEntity);
  // ＋ NEW TASK as a button of its own (owner, 2026-09-19: „[Zitat entfernt]“):
  // the list's first row stays, but it scrolls away and is hidden while a search runs
  const newBtn = el("button", "shrbtn primary qnewbtn", "＋ New task") as HTMLButtonElement;
  newBtn.type = "button";
  newBtn.onclick = () => {
    if (qBundleMode) { qBundleMode = false; qSel.clear(); }
    if (qView !== "work") chooseView("work");
    qSelect(null);
    qCompose?.focus();
  };
  shell.tools.appendChild(newBtn);
  shell.tools.appendChild(bundleBtn);
  shell.tools.appendChild(layoutBtn);

  const drow = el("div", "qdisp");
  qFootPaint = null;
  if (dispatch.available) {
    // the strip lives OUTSIDE the poll-guarded list rebuild, so it repaints itself from `dispatch`
    // after a toggle and on every poll (renderQueue calls qFootPaint) rather than waiting for a
    // rebuild that may never come
    const label = el("span", "");
    const toggle = el("button", "shrbtn", "") as HTMLButtonElement;
    const paint = () => {
      const f = queueFootState(dispatch, autosOnSrv, quietHoursSrv);
      label.textContent = f.text;
      label.title = f.tip;
      toggle.textContent = dispatch.on ? "turn off" : "turn on";
      toggle.title = dispatch.on ? "Master aus: freigegebene Aufgaben warten, bis du sie startest."
        : "Master an: die Fleet startet freigegebene Aufgaben ohne dich.";
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
    qFootPaint = paint;
    drow.append(label, toggle);
  } else {
    drow.textContent = "Dispatcher unavailable (set FLEET_DISPATCH_REPO to auto-run queued tasks)."
      + " Tasks are still tracked; send them by hand.";
  }
  // the dispatcher's state is a fact about the whole machine, not a filter on this list: it rides
  // the window's foot, out of the toolbar the owner scans for scope
  shell.foot.replaceChildren(drow);

  renderQueue();
  renderQueueDetail();
  search.focus();
}


export function initQueue(): void {
  $("queuebtn").onclick = () => openQueue();
}

export function setQueueTreeOn(value: boolean): void { qTreeOn = value; }
export function invalidateQueueList(): void { qKey = ""; }
export function setProgramsPoll(value: ProgramDigest[]): void { programsPoll = value; }
export function setProgramsStale(value: number): void { programsStale = value; }
export function setQueueDetailKey(value: string): void { qDetailKey = value; }
