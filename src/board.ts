import { $, el, RECENT_MS, tasksList, SlotInfo, TEntry, WorktreeInfo, api, autosList, baseName, closeFxMenu, copyText, fleet, fmtDur, fmtTs, focused, fxAsked, fxGit, fxInputEl, fxMenu, fxOpenSet, fxQuery, fxRestoreAfterPaint, fxScroll, fxSearchInput, fxStartDrag, fxTree, fxTreeOf, fxView, instanceLinks, instanceName, isMobile, switchLinks, landsEnabled, laneBandNames, laneLabel, laneNameOfBranch, loadTree, openActivity, openAkte, openExplorer, openExportDlg, openMergeDiff, openPacks, openReview, openShareDlg, paintTree, panes, post, refresh, rememberShas, renderDiffInto, reviewBody, serverNow, showSlot, slotState, slotsEl, stacksOf, startRename } from "./client";
import { loadPrograms, openQueue, programsList, programsPoll, programsRead, qSelect } from "./queue";
import { prefBool, prefJSON, prefNumber, prefSet, prefSetBool, prefText } from "./prefs";
import { popover } from "./popover";
import { openK15Entwurf } from "./k15-lader";
import { boardBranch, boardRepo, branchBusy, branchCharge, loadBranches, lookedLine, mayCheck,
  chooseLandForm, onPlacesChanged, restartSession, startCheck, startSession } from "./branchcard";
import { GS_CSS, GS_WORD, distanceLine, gitModel, gitStructure, headWords, mergeCheckLine, rowOf, sessionRepo, type GsCard, type GsHead, type GsModel, type GsWord } from "./gitstruktur";
import type { BranchView } from "./protocol";
import { askRisk } from "./dialog";
import { Shell, openShell } from "./shell";
import { PostLandAuditInfo, PostLandAuditLiveInfo, SuiteOfferRow, instanceBandText, type InstanceSource, type WorkplaceCheck, type WorkplaceChecks, type WorkplaceRepo, type WorkplaceRow, type WorkplaceStand, type Workplaces } from "./protocol";
import { projectHue } from "./marks";
import { modelLabel } from "./modelname";
import { isSlashLine } from "./slashcommand";
import { MeterBall, MeterStation, laneDisplayName, laneTail, meterKind, mmss, shortTitle, suiteMeter } from "./suitemeter";
import { CHECK_KIND, RUN_STATE, SECTION } from "./board-words";
import { PLA_ACK_KEY, postLandAlarm, plaHolder, plaNeedsOwner, type PlaHolder } from "./plaudit";
import { porcelainPath } from "./gitpath";
import { icon, type IconName } from "./icons";
import { devbtn, deviceOnlineMs, devicesSection, helperDevicesInfo } from "./devices";
import { compTray, serverClock } from "./composer";
import { rightsSection, wireRights } from "./rights";
import { perfRebuild } from "./perfmarks";
import { OFF_WHY, freshSuccession, handoverAt, handoverFlow } from "./handover";
import { loadPostfach, postfachBody, postfachOf, postfachSummary } from "./postfach";
import { fassungKurz } from "./fassung-zeile";
import { EIGEN_WORT, umfeldZeilen, type UmfeldTeil, type UmfeldZeile } from "./fassung-umfeld-zeilen";

// WHAT THIS INSTANCE IS (ranke-notiz R11, card 2026-10-06): the instance.source of the sessions
// poll — set only on an instance testinstanz.sh started, never on the live fleet. Null there, and
// every reader of it (the Arbeitsorte rows, the rights wording) keeps exactly the live picture.
let instanceSource: InstanceSource | null = null;
export function setInstanceSource(s: InstanceSource | null) { instanceSource = s; }

// the rights block reads the queue's lists through the board, never by import (src/rights.ts#wireRights)
wireRights({
  tasks: () => tasksList, programs: () => programsList, programsPoll: () => programsPoll,
  // the block's own read repaints the board when it moves the answer — loadPrograms repaints only the
  // queue, and "steht gleich hier" must not wait for the 3 s tick; unchanged (floored fail) paints nothing
  programsRead: () => programsRead, loadPrograms: () => { const was = programsRead; return loadPrograms().then(() => { if (programsRead !== was) void renderBoard(); }); },
  source: () => instanceSource,
  openSheet: (repo) => { openQueue(); qSelect(`repo:${repo}`); },
});

// --- right sideboard: session brief (desktop-only). Deterministic layers only —
// git facts fetched fresh from /brief per render, and the prompt outline derived from
// the SAME transcript feed the conversation view renders. No state of its own to drift.
export interface BriefCommit { hash: string; ts: number; subject: string }
export interface BriefInfo { branch: string | null; head: string | null; worktree: WorktreeInfo | null;
  sessionStart: number | null;
  // the COUNTS are true, the LISTS are capped at 200 — never derive one from the other
  uncommitted: number; uncommittedFiles: string[]; files: string[]; filesTotal: number; shortstat: string;
  commits: BriefCommit[]; repoCommits: BriefCommit[]; laneScoped: boolean; laneBase: string | null;
  commitsCap: number;
  ahead: number; behind: number; gitOp?: boolean;
  // the non-git half of the brief (server.ts#sessionSetup): what this session was BUILT from.
  // `packsFrom` says how strong the pack list is — "receipt" is what was delivered into this
  // pane, "program" only what its program declares now, null is "neither exists".
  setup?: BriefSetup;
  // what the SUCCESSION rail has already done with this session (server.ts#successionFacts).
  // Optional for an older server, and every field keeps the server's three-valued honesty: a null
  // fill is "cannot measure", a null thresholdPct comes with the reason no threshold applies, and
  // a null cap means no lid exists to spend — none of the three is ever a zero.
  succession?: BriefSuccession }
// the brief route's answer for a session in a plain folder (server.ts#cwdGitBody): a 400 that is
// NOT a failure — the git half is not-applicable, the non-git half is still this session's
export interface BriefNoGit { error: string; git: "none" | "gone" | "unreadable" | "error";
  sessionStart?: number | null; setup?: BriefSetup; succession?: BriefSuccession }
export interface BriefSuccession {
  rail: "lane" | "standard-main" | "game-maker-main" | "handoff";
  fill: { usedTokens: number; windowTokens: number; pct: number } | null;
  thresholdPct: number | null;
  thresholdOff: "steward" | "waiting" | "unpinned" | "harness" | "fleet" | "rail" | "session" | null;
  nudges: number; nudgedAt: number | null; gaveUp: boolean; maxNudges: number;
  // the fill the newest ask was written at (server.ts#successionFacts), an older server sends none
  nudgedPct?: number | null;
  session: number; taken: number | null; cap: number | null;
  // the owner's per-session setting (server.ts#patchHandover): the rail's env value, whether the
  // threshold above is this session's own, and whether the hint is on. An older server sends none of
  // the three — successionOf reads them as the fleet's values then.
  defaultPct: number; pctFrom: "session" | "fleet"; nudgeOn: boolean;
  sessionPct?: number | null;
  // K9 S2 (server.ts#successionFacts): the warm switch in force and where it comes from, the prompt
  // cache as the transcript says it, the newest compaction of this occupant. An older server sends none.
  keepCache?: { on: boolean; from: "session" | "fleet"; fleetOn: boolean; exempt: "steward" | "lane" | "harness" | null;
    idleMin: number; lifetimeMin: number; hourCap: number; warmTurns: number;
    // S2b: the fleet's duration, and the warm turn's own text (null = the fleet's) — an older server sends none
    fleetIdleMin?: number; text?: string | null; fleetText?: string; textMax?: number;
    // the next warm turn and why none comes (server/succession.ts#warmDecision), its lid — an older server sends none
    dueAt?: number | null; reason?: string; warmMax?: number };
  cache?: { state: "warm" | "kalt" | "kompaktiert" | "unbekannt"; lastCallAt: number | null; ttlSec: number; coldAt: number | null };
  compaction?: { at: number; preTokens: number | null; postTokens: number | null; trigger?: string; idle?: boolean } | null;
  // K16 Teil 2: whether this occupant was started with Claude Code's own auto-compaction (server/session-start.ts
  // `autoCompactEnabled`); a server that does not record it sends none, and the column says „nicht gemeldet“
  autoCompact?: boolean | null;
  // K9 S3 (server.ts#successionFacts): the kind of session, the cap where Fleet's action is due, where the
  // base comes from, the choice at the threshold and the newest act — an older server sends none
  kind?: "orchestrator" | "program-main" | "bau" | "lane" | "session"; capPct?: number | null;
  thresholdFrom?: "session" | "env" | "fleet";
  atThreshold?: "hint" | "compact" | "succeed"; choices?: ("hint" | "compact" | "succeed")[];
  // K9 S3b-2: the fleet's value for this session (since 18.10. the hint for every kind); a server before S3b-2 sends none
  fleetChoice?: "hint" | "compact" | "succeed";
  act?: { at: number; act: "compact" | "succeed"; outcome: string } | null;
}
export interface BriefSetup { profile: "standard" | "game-maker" | null;
  repo: string | null; head: string | null;
  // sources are POINTERS (path + one anchor string), never content — see server.ts#SetupSource.
  // null sources + a privateSourceId = a private pack, whose content the server cannot read.
  packs: { id: string; useWhen: string | null;
    sources: { path: string; anchor: string }[] | null; privateSourceId: string | null }[];
  omitted: { id: string; why: string }[];
  deliveredAt: number | null; deliveredBytes: number | null;
  packsFrom: "receipt" | "program" | null }
// Which repo string the REPO-WIDE routes will accept for this slot. `/api/commits` validates its
// `repo` against knownRepos() (server.ts) — which holds a lane's PARENT repo and a plain session's
// own cwd, never a lane's worktree path. Measured 2026-08-20: for a lane, `worktree.repo` is in
// that list; for a plain repo session, `cwd` is. `repo` (the canonical toplevel) is deliberately
// NOT preferred — a session opened in a SUBDIRECTORY has a toplevel that knownRepos never added,
// and the lens says so honestly rather than this guessing a third spelling.
export const repoOfSlot = (s: SlotInfo | undefined, brief: BriefInfo): string | null =>
  brief.worktree?.repo ?? s?.cwd ?? null;

export const boardBody = document.getElementById("boardbody")!;
export let boardOpen = prefBool("fleet.board");
// the width toggle's persisted state (a src/prefs.ts row). The EFFECTIVE limit is termLimitOn AND
// the pane's own conditions — a reload restores the toggle, layout > 1 or the phone view lifts it
// (Pane#termIsLimited).
export let termLimitOn = prefBool("fleet.termlimit");
export function setTermLimit(on: boolean) {
  termLimitOn = on;
  prefSetBool("fleet.termlimit", on);
  for (const p of panes) p.syncCornerButtons();
}
export let boardBusy = false;
let boardAgain = false;
// THE BOARD'S FOLDS. Only what a reader reaches for rarely still sits behind a disclosure —
// files and lanes became sections of their own, and the advisory agents left the column. Module
// state, so the 3s re-render cannot snap one shut while you read in it; remembered per browser.
export const boardFolds: Set<string> = (() => {
  const v: unknown = prefJSON<unknown>("fleet.board.folds");
  return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
})(); // a hand-edited or foreign value is "nothing open", not a crash — prefJSON degrades, the shape guard stays here
// --- WHOSE FACT IS THIS? (owner, 2026-09-20: „[Zitat entfernt]“
// ). The column mixes four reaches and used to say which for none of them, so a fleet-wide
// number read as a number about the session under the cursor. One word per section head, from a
// closed set, and the hover says what the word covers:
//   session — this pane's own conversation and the work in its tree
//   repo    — the repository this session sits in: its history, its other lanes, its files
//   machine — this box: the code that is deployed on it, the errors its server logged
//   fleet   — this server and every device it lends work to (and, where one exists, the named
//             end of that reach: another instance is NOT included)
export type BoardScope = "session" | "repo" | "machine" | "fleet";
export const SCOPE_TITLE: Record<BoardScope, string> = {
  session: "a fact about THIS session — the pane under the cursor, its conversation and the work in its tree",
  repo: "a fact about the REPOSITORY this session sits in — shared with every other lane in it",
  machine: "a fact about THIS MACHINE — the same for every session on this box, whatever pane you focus",
  fleet: "a fact about the WHOLE FLEET — this server and the devices it lends work to",
};
export function scopeTag(scope: BoardScope): HTMLElement {
  const t = el("span", "bscope", scope);
  t.title = SCOPE_TITLE[scope];
  return t;
}
// a section head that carries its own reach: <h3>Title <span class=bscope>session</span></h3>
export function boardHead(title: string, scope: BoardScope): HTMLElement {
  const h = el("h3", "", title);
  h.appendChild(scopeTag(scope));
  return h;
}

export function boardFold(key: string, title: string, count: string | null, fill: (body: HTMLElement) => void): HTMLElement {
  const open = boardFolds.has(key);
  const box = el("div", `bfold${open ? " open" : ""}`);
  const hd = el("button", "bfoldhd") as HTMLButtonElement;
  hd.setAttribute("aria-expanded", String(open));
  hd.append(el("span", "bchev"), el("span", "bfoldt", title), ...(count !== null ? [el("span", "bfoldn", count)] : []));
  hd.onclick = () => {
    if (boardFolds.has(key)) boardFolds.delete(key); else boardFolds.add(key);
    prefSet("fleet.board.folds", JSON.stringify([...boardFolds]));
    void renderBoard();
  };
  box.appendChild(hd);
  // a folded group builds nothing: its body is only filled (and its data only fetched) when open
  if (open) {
    const body = el("div", "bfoldbody");
    fill(body);
    box.appendChild(body);
  }
  return box;
}
// ↻ REBASE: in flight per slot, and the one sentence the column owes afterwards. Module state,
// because the 3s repaint rebuilds every node — a result that lived in the DOM would vanish before
// it was read. The note is deliberately sticky: a rebase that SUCCEEDED removes the very count
// that explained the button, so without it the column would look as if nothing had happened.
export const rebaseBusy = new Set<number>();
export const rebaseNote = new Map<number, { ok: boolean; text: string; files?: string[]; at: number }>();
export const REBASE_NOTE_MS = 10 * 60_000;
export async function doRebase(slot: number): Promise<void> {
  if (rebaseBusy.has(slot)) return;
  rebaseBusy.add(slot);
  rebaseNote.delete(slot);
  void renderBoard();
  try {
    const r = await post(`/api/slots/${slot}/rebase`, {});
    const j = (await r.json().catch(() => null)) as
      { ok?: boolean; base?: string; was?: number; head?: string; from?: string;
        error?: string; reason?: string; files?: string[]; restored?: boolean } | null;
    if (r.ok && j?.ok) {
      rebaseNote.set(slot, { ok: true, at: Date.now(),
        // what it did NOT do is half the sentence: nothing here was verified and nothing landed
        text: `Rebased ${j.was} commit${j.was === 1 ? "" : "s"} onto ${j.base} — now at ${j.head}. `
          + "Nothing was verified and nothing was landed: run the verify chain again before landing." });
    } else {
      const why = j?.error ?? `the rebase failed (HTTP ${r.status})`;
      rebaseNote.set(slot, { ok: false, at: Date.now(), files: j?.files,
        text: j?.reason === "conflict" && j?.restored === false
          // the abort is asserted server-side; if it could NOT be asserted, that is the headline
          ? `${why} WARNING: the worktree could not be confirmed unchanged — check it in the lane's own session.`
          : why });
    }
  } catch {
    rebaseNote.set(slot, { ok: false, at: Date.now(), text: "the server could not be reached — nothing was rebased" });
  } finally {
    rebaseBusy.delete(slot);
    await refresh(); // the brief's ahead/behind is stale the moment this returns
    void renderBoard();
  }
}
// The board's popovers (the session's ⋯, the ⋯ beside Land lane, the handover settings — boardPop
// below) and the Explorer's action menu cannot be open on the same visible surface. They therefore
// share this K5 registration instead of adding another document-level outside-click listener.
// Both rebuild their rows, so panel, trigger and rows are read at event time.
popover({
  panel: () => fxMenu?.panel ?? boardBody.querySelector<HTMLElement>(".bpop"),
  trigger: () => fxMenu?.trigger ?? boardBody.querySelector<HTMLElement>("[data-pop].on:not(.bpop)"),
  isOpen: () => fxMenu !== null || boardPop !== null,
  close: (refocus) => {
    if (fxMenu) { closeFxMenu(refocus); return; }
    const kind = boardPop?.kind ?? null;
    boardPop = null;
    if (refocus) popFocus = kind;
    void renderBoard();
  },
  rows: () => fxMenu ? [...fxMenu.panel.querySelectorAll<HTMLButtonElement>(".fxmenuitem")]
    : [...boardBody.querySelectorAll<HTMLButtonElement>(".bpop .bmenuitem, .bpop .pr button")],
});
// per-slot outline cursor, incremental like pollChat: full fetch once, then only new entries
export const outline = new Map<number, { total: number; source: string | null; prompts: string[]; err: string | null }>();
// A review finding as the OUTCOME LENS reads it (src/client.ts, the outcome detail): the board's
// own advisory review left on 2026-09-20, this type did not — the ③ auto-review keeps writing
// findings into the outcome ledger, and that lens still renders them.
export interface ReviewFinding { title: string; file: string; line: number | null;
  impact: "high" | "medium" | "low"; cost: string; basis: "verified" | "inferred"; detail: string }
// lane map + ⏫ merge agent (async job on the server; the board's 3s poll carries state)
export interface WtRisk { dirtyFiles: string[]; unpushedCommits: { hash: string; subject: string }[];
  shortstat: string | null; empty: boolean; unknown?: string | null }
export interface WtRow extends WtRisk { path: string; branch: string; slot: number | null; dirty: number; ahead: number; behind: number; note?: string | null;
  notepad?: string | null; review?: ReviewCandidateInfo | null }
// server.ts#ReviewCandidateView — a lane parked for later owner review, with its identity
export interface ReviewCandidateInfo { id: string; parkedAt: number; expiresAt: number; expired: boolean; branch: string;
  head: string; base: string | null; baseSha: string | null; taskIds: string[]; reportId: string }
export interface WtInfo { repo: string; main: string; worktrees: WtRow[] }
// 💾 lane commit in flight, per slot — carries the MODE so the button can label itself
// ("… saving" vs "… writing message") while the request runs.
export const commitBusy = new Map<number, "quick" | "agent">();
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
export type VerifyVerdict = { cmd: string; ok: boolean | null; out: string; at: number; mainSha: string; stale?: boolean;
  timedOut?: true; waitedOut?: true; serverDown?: true; startedAt?: number; ms?: number; waitMs?: number; waitPartial?: true;
  exitCode?: number | null };
export interface MergeState { running: boolean;
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
  lane?: { repo: string; branch: string } }
export function failedLandVerdict(last: MergeState["last"]): boolean {
  return !!last && !last.landed && ["blocked", "error", "interrupted"].includes(last.status);
}
export const landAlarmOpens = new Set<string>();
// slots with a merge job the client kicked off or observed — when such a slot goes
// inactive (job landed the lane), its panes must be released like a manual ⏏ does
export const mergeWatch = new Set<number>();

// synchronous in-flight guards: the server serializes too, but a double-click must not
// even fire the second request (the response to it would just say "running"/"reserved")
export const mergePending = new Set<number>();
export let laneReqBusy = false;
// ☠ discard confirm state — module-level because the board fully re-renders on a 3s poll:
// the panel (and its read-first countdown) must survive re-renders, so each render derives
// it from here instead of holding DOM state. `at` anchors the 4s gate to the FIRST click.
export let discardArm: { path: string; at: number } | null = null;
export const DISCARD_READ_MS = 4000;
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && discardArm) { discardArm = null; void renderBoard(); }
});

// shared risk-preview panel: shows the ACTUAL file names / commit subjects a destructive
// action is about to touch, before the click — not only after a refusal (the server always
// re-verifies via worktreeRisk regardless of what this shows; this is purely informational).
export function showRiskPreview(title: string, risk: WtRisk, confirmLabel: string): Promise<boolean> {
  const body: HTMLElement[] = [];
  if (risk.empty) {
    body.push(el("div", "riskempty", "safe — no uncommitted changes, no unpushed commits"));
  } else {
    // server.ts#worktreeRisk · a read that failed: not safe, not a list — the server refuses on it too
    if (risk.unknown) body.push(el("div", "riskhead", `could not verify (${risk.unknown}) — check manually before proceeding`));
    if (risk.dirtyFiles.length) {
      body.push(el("div", "riskhead",
        `${risk.dirtyFiles.length} uncommitted file${risk.dirtyFiles.length === 1 ? "" : "s"}`));
      const list = el("div", "risklist");
      for (const f of risk.dirtyFiles.slice(0, 40)) list.appendChild(el("div", "riskfile", f));
      if (risk.dirtyFiles.length > 40) list.appendChild(el("div", "riskmore", `… ${risk.dirtyFiles.length - 40} more`));
      body.push(list);
    }
    if (risk.unpushedCommits.length) {
      body.push(el("div", "riskhead",
        `${risk.unpushedCommits.length} unpushed commit${risk.unpushedCommits.length === 1 ? "" : "s"}`));
      const list = el("div", "risklist");
      for (const c of risk.unpushedCommits.slice(0, 40)) list.appendChild(el("div", "riskcommit", `${c.hash} ${c.subject}`));
      body.push(list);
    }
  }
  return askRisk({
    title,
    body,
    buttons: [
      { label: "cancel", value: false },
      { label: confirmLabel, danger: true, value: true },
    ],
  });
}
// fail CLOSED: if the risk fetch itself fails, never claim "empty/safe" — show it as a
// single unverifiable "file" so the preview still reads as "don't assume, go check"
export const UNKNOWN_RISK: WtRisk = { dirtyFiles: ["(could not verify — check manually before proceeding)"], unpushedCommits: [], shortstat: null, empty: false };
export async function fetchSlotRisk(slotId: number): Promise<WtRisk> {
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
export async function doLand(slot: number) {
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
    // the land form chosen in this browser (#landFormOf), for /merge only: "alle Commits" names
    // {"squash":false}, "ein Commit" is the server's default and sends no switch; ⏏ takes none at all
    const commits = landFormOf(s.worktree.repo, s.cwd ?? null).form === "commits";
    const direct = await post(`/api/slots/${slot}/land`, {});
    if (direct.ok) {
      for (const p of panes) if (p.slot === slot) p.assign(0);
      await refresh();
      return;
    }
    const r = await post(`/api/slots/${slot}/merge`, commits ? { squash: false } : {});
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
export async function doMergeLand(slot: number) {
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
// `review` is the opt-in REVIEW PARK: the server mints a candidate (task ids, branch, head, base,
// accepted report, deadline) or refuses by name — only a clean lane whose MAIN accepted its report.
export async function doShelve(slot: number, review = false) {
  const s = fleet[slot - 1];
  if (!s?.worktree) return;
  const note = prompt(review
    ? "Park this lane for your review — frees the slot, keeps worktree and task identity. Note?"
    : "Shelve this lane — what's left to do? (shown when you resume it)");
  if (note === null) return; // cancelled
  const r = await post(`/api/slots/${slot}/shelve`, review ? { note, review: true } : { note });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    alert(j.error ?? "shelve failed");
    return;
  }
  for (const p of panes) if (p.slot === slot) p.assign(0);
  await refresh();
}

// 💾 save a lane's uncommitted work — the gap land/merge (dirty-tree refusers) leave open.
// quick = deterministic wip commit; agent = a short-lived agent writes a conventional-commit
// message (falls back to wip). Commit-only, reversible; the server never pushes or lands.
export async function doCommit(slot: number, mode: "quick" | "agent", activeConfirmed = false): Promise<void> {
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
export function sessionActive(slot: number): boolean {
  const s = fleet[slot - 1];
  return !!s && s.cwd !== null && serverNow - s.lastOutput < RECENT_MS;
}

// a circle of the git structure reads the bar's own state (owner Z118: Slot 5 green in the bar, grey in the structure) —
// the bar counts a slot the viewer has open as working (src/client.ts#outputState)
function slotWorks(slot: number): boolean {
  const s = fleet[slot - 1];
  return !!s?.cwd && slotState(s, serverNow, panes.some((p) => p.slot === slot)) === "work";
}

// mid-run guard for the commit action: the session is producing output, so a commit now would
// snapshot a half-finished tree. Confirm, don't forbid — sometimes you DO want to save before
// killing a stuck run.
export function confirmMidRun(slot: number): Promise<boolean> {
  return askRisk({
    title: `Slot ${slot} is still working`,
    body: [el("div", "bmidrun",
      "This session produced output a moment ago — it may be mid-edit. Committing now snapshots a half-finished "
      + "tree, and an agent message would describe that partial state. It's reversible (git reset), but usually "
      + "you want to let the run finish first.")],
    buttons: [
      { label: "wait", value: false },
      { label: "commit anyway", danger: true, value: true },
    ],
  });
}

// commit for a MAIN (non-lane) session: preview exactly what `git add -u` will stage
// (tracked changes) and which untracked files are left alone, THEN commit. The server
// re-derives everything; this preview is the guardrail that makes a commit onto a shipped
// branch as transparent as a lane commit onto a throwaway one.
export function showCommitPreview(title: string, tracked: string[], untracked: string[], active: boolean): Promise<boolean> {
  const body: HTMLElement[] = [];
  if (active) body.push(el("div", "bmidrun",
    "⚠ this session is still working — you may be committing a half-finished snapshot."));
  body.push(el("div", "riskhead", `${tracked.length} tracked file${tracked.length === 1 ? "" : "s"} → committed (git add -u)`));
  const tl = el("div", "risklist");
  for (const f of tracked.slice(0, 40)) tl.appendChild(el("div", "riskfile", f));
  if (tracked.length > 40) tl.appendChild(el("div", "riskmore", `… ${tracked.length - 40} more`));
  body.push(tl);
  if (untracked.length) {
    body.push(el("div", "riskhead skip", `${untracked.length} untracked file${untracked.length === 1 ? "" : "s"} → left alone`));
    const ul = el("div", "risklist");
    for (const f of untracked.slice(0, 20)) ul.appendChild(el("div", "riskfile skip", f.slice(3)));
    if (untracked.length > 20) ul.appendChild(el("div", "riskmore", `… ${untracked.length - 20} more`));
    body.push(ul);
  }
  return askRisk({
    title,
    body,
    buttons: [
      { label: "cancel", value: false },
      { label: "commit", value: true }, // reversible → not styled destructive
    ],
  });
}

// " (ran 362s, 255s of it queued behind the suite mutex)" — empty when the record predates the
// timing fields. The wait half is what turns "the gate says no" into "the gate never got to look".
export function spentText(v: VerifyVerdict): string {
  if (v.ms === undefined) return "";
  const s = (ms: number): string => `${Math.round(ms / 1000)}s`;
  return ` (ran ${s(v.ms)}${v.waitMs !== undefined ? `, ${v.waitPartial ? "at least " : ""}${s(v.waitMs)} of it queued behind the suite mutex` : ""})`;
}
// pre-land review: show the diff that will land on main (main...HEAD, three-dot) BEFORE it
// lands. Closes the gap where a conflict-free rebase auto-landed with no diff ever shown —
// "textually clean" isn't "semantically correct", so the owner gets one look before it merges.
// the one deterministic land signal made visible (F-A.3): did the rebased tree pass verify.
// Informational only: the badge never disables a button. The SERVER holds the bar — a confirm over
// a recorded verify that is not green is refused with 409 (578e8975); a stale green stays the
// owner's call. The FOUR
// ways of having no verdict are told apart and none reads green: no command CONFIGURED reads
// "unverified", a command that DECLINED to run reads "skipped", one our own clock killed while it
// was working reads "timed out", and one killed while it was still queued behind the suite mutex
// reads "never ran" — the last two say nothing whatever about the tree, the last not even "slow".
export function verifyBadge(v: VerifyVerdict | undefined): HTMLElement {
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
// how far it got before the clock killed it, before deciding how to repair it.
export function showVerifyOutput(v: VerifyVerdict): void {
  const skipped = v.ok === null;
  const box = el("div", "difftxt");
  box.textContent = v.out || "(no output captured)";
  // an output VIEWER, not a question — one close button; the promise's answer is ignored
  void askRisk({
    title: v.waitedOut ? "verify — never started, output so far"
      : v.timedOut ? "verify — timed out, output so far"
      : v.serverDown ? "verify — a suite server did not come up, output"
      : skipped ? "verify — skipped, output" : "verify ✗ — output",
    body: [
      el("div", `diffstat ${skipped ? "warn" : "err"}`,
        `${v.cmd} · ${v.waitedOut ? `killed while still queued behind the suite mutex — this tree was never looked at${spentText(v)}`
          : v.timedOut ? `killed at the work timeout — nothing was checked${spentText(v)}`
          : v.serverDown ? "a suite's own server did not come up — nothing was checked"
          : skipped ? "declined to verify this tree — nothing was checked" : "exit non-zero"}`),
      box,
    ],
    buttons: [{ label: "close", value: false }],
  });
}

export async function showLandReview(title: string, slot: number, verify?: VerifyVerdict): Promise<boolean> {
  // fail CLOSED: a dropped fetch or non-JSON/non-200 body must NEVER read as a clean empty
  // diff — that path renders "just cleans up" with ⏏ enabled and lands agent-resolved
  // conflicts with zero human eyes. Same posture as fetchSlotRisk's UNKNOWN_RISK.
  const data = await api(`/api/slots/${slot}/merge-diff`)
    .then(async (r) => (r.ok ? await r.json() : { loadFailed: true }))
    .catch(() => ({ loadFailed: true })) as
    { main?: string; branch?: string; files?: string[]; diff?: string; truncated?: boolean; error?: string; loadFailed?: boolean };
  const body: HTMLElement[] = [
    el("div", "hint landhint",
      "This is the merge preview — everything that will land on main (main…HEAD). Committing does NOT clear it; only landing does. A clean worktree with commits ahead is exactly what a ready-to-land lane looks like."),
  ];
  let landFailed = false;
  if (data.loadFailed) {
    body.push(el("div", "diffstat err",
      "couldn't load the merge preview — landing is disabled until it loads. Retry, or check the connection."));
    landFailed = true;
  } else if (data.error) {
    body.push(el("div", "diffstat", data.error));
  } else {
    const n = data.files?.length ?? 0;
    const stat = el("div", "diffstat",
      `${data.branch ?? "?"} → ${data.main ?? "main"} · ${n} file${n === 1 ? "" : "s"}${data.truncated ? " · diff truncated" : ""} `);
    stat.appendChild(verifyBadge(verify));
    body.push(stat);
    if (data.diff) { const box = el("div", "difftxt"); renderDiffInto(box, data.diff); body.push(box); }
    else body.push(el("div", "diffstat", "no committed changes to land — landing just cleans up the worktree"));
  }
  return askRisk({
    title,
    body,
    panelClass: "riskpanel landreviewpanel",
    buttons: landFailed ? [
      { label: "cancel", value: false },
      // fail closed — no land gesture without a diff that actually loaded
      { label: "retry", value: false, next: () => showLandReview(title, slot, verify) },
      { label: "⏏ land", value: true, disabled: true },
    ] : [
      { label: "cancel", value: false },
      { label: "⏏ land", value: true },
    ],
  });
}

export async function doCommitMain(slot: number, mode: "quick" | "agent", files: string[]): Promise<void> {
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

// THE INFO COLUMN ON THE PHONE (owner 2026-09-22: „[Zitat entfernt]“
// ). ℹ moves the REAL #board element into a fullscreen window (G6.3) — the same live
// content the column renders, not a copy; the column itself stays display:none on mobile
// (applyBoard). On any close the element goes home to #app (its last child — where it started).
export let boardShell: Shell | null = null;
export function openBoardWindow(): void {
  if (boardShell?.isOpen()) return;
  const board = $("board");
  const app = $("app");
  if (!board || !app) return;
  // the element reference is captured HERE, while #board is still in the document: on close the
  // window root is already detached, and getElementById finds nothing outside the document — the
  // board would die with the removed window (measured: appChildren without "board" after ✕)
  boardShell = openShell({ id: "board", title: "Info", onClose: () => {
    boardShell = null;
    if (board.parentElement !== app) app.appendChild(board);
    if (boardOpen) { boardOpen = false; prefSetBool("fleet.board", false); applyBoard(); }
  } });
  boardShell.root.classList.add("boardwin");
  boardShell.detail.appendChild(board);
  // the window's Escape runs in the capture phase: an open sheet (the session's ⋯, the ⋯ beside Land
  // lane, the handover settings) closes first, the window with the next one (G4.1)
  boardShell.setCloseGuard(() => {
    if (!boardPop) return false;
    popFocus = boardPop.kind;
    boardPop = null;
    void renderBoard();
    return true;
  });
}

export function applyBoard() {
  document.body.classList.toggle("board", boardOpen && !isMobile());
  // the toggle lives per-pane (in the corner group) — sync them all; "on" is aria-pressed (G1.3),
  // the .active class stays as the second state name the rest of the file already reads
  for (const b of document.querySelectorAll<HTMLButtonElement>(".boardtoggle")) {
    b.classList.toggle("active", boardOpen);
    b.setAttribute("aria-pressed", boardOpen ? "true" : "false");
  }
}
export function setBoard(on: boolean) {
  boardOpen = on;
  prefSetBool("fleet.board", on);
  if (isMobile()) {
    // the phone has no column: ℹ opens/closes the fullscreen window that carries #board (G6.3).
    // close() runs onClose synchronously, which re-homes the element and un-presses the buttons.
    if (on) openBoardWindow();
    else boardShell?.close();
  }
  applyBoard();
  // the board's width changed → terminals must refit (same rule as the sidebar collapse)
  requestAnimationFrame(() => { for (const p of panes) p.refit(); });
  if (on) { void renderBoard(); renderSuiteMeter(); }
}

export async function pollOutline(slot: number): Promise<{ prompts: string[]; err: string | null }> {
  const c = outline.get(slot) ?? { total: 0, source: null, prompts: [], err: null };
  try {
    const res = await api(`/api/slots/${slot}/transcript?after=${c.total}`);
    // a failed read is remembered AS a failed read: "no prompts" and "could not ask" are
    // different sentences, and the fold said the first one for both until 2026-09-20
    if (!res.ok) { c.err = `HTTP ${res.status}`; outline.set(slot, c); return { prompts: c.prompts, err: c.err }; }
    const data = (await res.json()) as { entries: TEntry[]; total: number; source: string | null };
    // fresh claude after a self-heal → transcript restarted; rebuild from the top
    if (c.source !== null && data.source !== c.source) {
      outline.set(slot, { total: 0, source: data.source, prompts: [], err: null });
      return { prompts: [], err: null };
    }
    c.source = data.source;
    for (const e of data.entries) {
      if (e.role !== "user") continue;
      // one outline row per user text block — exactly mirrors the .msg.user elements
      // appendEntry creates, so row index i maps to showPromptAt(i)
      for (const b of e.blocks) {
        // a slash command and its output are one quiet line there, not a bubble (Pane#addSlashLine)
        if (b.t !== "text" || isSlashLine(b.text)) continue;
        const first = b.text.split("\n").find((l) => l.trim()) ?? "";
        c.prompts.push(first.trim().slice(0, 100) || "(empty)");
      }
    }
    c.total = data.total;
    c.err = null;
    outline.set(slot, c);
  } catch {
    c.err = "the server could not be reached";
    outline.set(slot, c);
  }
  return { prompts: c.prompts, err: c.err };
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
export interface GateInfo {
  lock: { pid: number | null; alive: boolean | null; heldMs: number; ageMs?: number; acquiredAt?: number | null;
    owner?: { slot: number | null; branch: string };
    identityProven?: boolean | null; birth?: { stored: string | null; current: string | null; state: string };
    nextAction?: string; reason?: string; effect?: string; state?: string } | null;
  reports: { slot: number | null; label: string | null; phase: string; suite: string; exitCode: number | null; at: number;
    origin?: string; branch?: string | null; stage?: string; stats?: { n: number; p50: number; p90: number } }[];
  // the ticket line at the machine-wide suite mutex (server.ts#suiteQueueView). Absent from an
  // older server, and absent then means NOT REPORTED — never "nobody is waiting".
  queue?: { n: number; pid: number; alive: boolean; dead?: string; sinceMs: number | null; position: number;
    owner?: { slot: number | null; branch: string } }[];
}
export let gateInfo: GateInfo | null = null;
// fmtDur rounds to whole minutes, which reads as "0m" for the first half-minute of a hold — the
// exact window in which someone is watching to see whether a suite actually started.
// Clamped because a report's age is a SERVER timestamp against this device's clock, and a phone
// running a few seconds ahead must read "0s", never a negative age.
export const gateAge = (ms: number): string => (ms < 90_000 ? `${Math.max(0, Math.round(ms / 1000))}s` : fmtDur(Math.max(0, ms)));

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
export let postLandLive: PostLandAuditLiveInfo | null = null;
export function gateSection(): HTMLElement | null {
  const g = gateInfo;
  if (!g) return null;
  const sec = el("div", "bsec");
  sec.appendChild(el("h3", "", "Prüfsperre"));
  sec.appendChild(gateLockHead(g.lock));
  return sec;
}
export function gateLockHead(lk: GateInfo["lock"]): HTMLElement {
  // the server names the state (it owns the overdue threshold — see SUITE_HOLD_OVERDUE_MS). The
  // fallback is for the deploy window where a newer bundle is served by an older server: it can
  // reproduce every state but `overdue`, so it under-warns rather than inventing one.
  const state = lk ? lk.state ?? (lk.alive === null ? "parked" : lk.alive ? "held" : "stale") : "free";
  // `pid null` is a lock file whose contents are not a pid — a lost holder either way, but
  // printing "pid null" would read as a bug in this line rather than as one on disk.
  const who = lk?.pid === null ? "unreadable pid file" : `pid ${lk?.pid}`;
  const ownerSlotId = lk?.owner?.slot ?? null;
  const ownerSlot = ownerSlotId ? fleet.find((x) => x.id === ownerSlotId) : undefined;
  const ownerTitle = ownerSlot?.worktree ? ownerSlot.taskTitle ?? null : null;
  const ownerName = lk?.owner?.slot === null ? "Fleet" : lk?.owner?.slot
    ? laneDisplayName(laneBandNames(stacksOf()).get(lk.owner.slot) ?? `Slot ${lk.owner.slot}`, ownerTitle) : "Fleet";
  // a lane with a title is named by it; its branch's four hex move to the tooltip below
  const owner = ownerTitle ? ownerName : `${ownerName} · ${lk?.owner?.branch ? laneTail(lk.owner.branch) : "Branch unbekannt"}`;
  const age = gateAge(lk?.ageMs ?? lk?.heldMs ?? 0);
  const id = lk?.identityProven === true ? "identity proven"
    : lk?.identityProven === false ? "identity mismatch"
    : "identity unknown";
  // gateAge measures from the CLAIM (the pid file's mtime), not from the holder's death — which
  // nothing here knows. So a dead holder is "claimed 18m ago", never "ended 18m ago".
  const head = el("div", "bstate",
    !lk ? "· check runs · idle"
      : state === "parked" ? `⏸ check runs · parked by hand (no pid) · ${age}`
      : state === "held" ? `${owner} · läuft seit ${age} · check run busy · ${who}`
      : state === "overdue" ? `${owner} · läuft seit ${age} · Prüfsperre überfällig (${who})`
      : state === "unknown" ? `${owner} · Halter unbekannt · ${age} · Prüfsperre (${who})`
      // NEUTRAL on purpose: every finished run leaves its dir behind (release is implicit), so
      // this is what an idle machine looks like — it was a ⚠ for one day and shouted constantly.
      : `· check runs · none running · stale lock (${who}, ${id}, claimed ${age} ago)`);
  head.title = (ownerTitle && lk?.owner?.branch ? `${ownerTitle} — ${lk.owner.branch} · ` : "")
    + (state === "free" ? "Kein Check hält gerade die maschinenweite Sperre (intern: suite mutex)."
    : lk?.reason || lk?.effect
      ? `Grund: ${lk.reason ?? "unknown"}; Nächstes: ${lk.nextAction ?? "unknown"}; Wirkung: ${lk.effect ?? "unknown"} (intern: lock reason/nextAction/effect)`
    : state === "stale" ? "Nichts läuft — ein beendeter Check lässt sein Sperr-Verzeichnis absichtlich zurück, der nächste räumt es weg (intern: stale lock)."
    : state === "overdue" ? "Der Halter lebt noch, hält aber viel länger als jeder Check auf dieser Maschine braucht — prüfe, ob er feststeckt (intern: overdue)."
    : "Die maschinenweite Sperre, von der Platte gelesen — Fleet liest nur, das Aufräumen eines toten Halters ist Sache der Wrapper (intern: suite mutex).");
  return head;
}

// --- THE CHECKS (card R4, rebuilt 2026-10-08): every suite on this machine, each run drawn once. A
// closed lane's row says nothing of its checks (owner 2026-10-10); an opened lane shows its points
// and its run, the check after the land stands under its repo's main, and everything else — a run
// without a lane, a closed lane's run named by the lane — stands in the Arbeitsorte's block
// "Prüfungen" (src/board.ts#runRows), with the machine's one-at-a-time lock only when it needs
// someone. The glass tube with its gliding balls is gone (§3a: "keine Bewegung außer Farbe", G0.4);
// the model below is unchanged (src/suitemeter.ts).
export let meterSuites: SuiteOfferRow[] = [];
export const METER_WORD: Record<MeterStation, string> = { wait: RUN_STATE.waiting, run: RUN_STATE.running, helper: "on a helper", done: "done" };
// a finished ball says HOW it finished — the station alone would call a red run "done"
export const meterState = (b: MeterBall): string =>
  b.station === "wait" ? RUN_STATE.waiting : b.station !== "done" ? RUN_STATE.running
  : b.tone === "red" ? RUN_STATE.failed : b.tone === "unknown" ? RUN_STATE.noResult : RUN_STATE.passed;
export function meterModel() {
  const laneNames = laneBandNames(stacksOf());
  return suiteMeter({
    instance: instanceName,
    gate: gateInfo, audit: postLandLive, offers: meterSuites, devices: helperDevicesInfo,
    slots: fleet.filter((s) => s.cwd).map((s) => ({ id: s.id, label: s.label,
      branch: s.worktree?.branch ?? null,
      letter: laneNames.get(s.id) ?? null, title: s.worktree ? s.taskTitle ?? null : null })),
  });
}
export const METER_TITLE: Record<MeterStation, string> = {
  wait: "Asked for, not started — a lane waits for the lock, no helper took an offer yet, or a land rolls into the next check (internal: suite mutex · post-land check).",
  run: "Running on this machine — what holds the machine-wide lock right now (internal: suite mutex).",
  helper: "Running on a helper device — a check this machine handed off (internal: suite offer).",
  done: "Finished in the last few minutes — green, red or without a result.",
};
// one run's state as the machines say a state, and what follows it: shared by the run rows below
// and the run lines under a lane, so both say the same words
function runSay(b: MeterBall): { state: MachineState; more: string[] } {
  const tone: MachineState["tone"] = b.station === "wait" ? "off" : "live";
  const ms = b.at > 0 ? serverClock() - b.at : 0;
  const word = b.station === "wait" ? RUN_STATE.waiting : b.station === "helper" ? `on ${b.where}` : `${RUN_STATE.running}${b.at > 0 ? ` ${mmss(ms)}` : ""}`;
  const e = b.station !== "wait" && b.expect && b.expect.p50 >= 1000 ? b.expect : null;
  const more = [b.what && !/^pid \d+$/.test(b.what) ? b.what : "",
    e ? (ms > e.p90 ? `longer than usual (~${mmss(e.p50)})` : `usually ~${mmss(e.p50)}`) : ""].filter(Boolean);
  return { state: { tone, word, title: METER_TITLE[b.station] }, more };
}
// THE RUNS BESIDE THEIR LANES (owner 2026-10-08: „[Zitat entfernt]“
// ): a run whose branch is a lane's stands as a line under that lane, the
// check after the land under its repo's main. Which runs found a place is kept per full render, so
// the Prüfungen block (and its in-place repaint between renders) lists only the rest.
// `doneByBranch`: a lane's runs that ended in the server's last minutes — only the diamond reads
// them (#gateLook), green or red for that while; no block lists them
let runsHere: { byBranch: Map<string, MeterBall[]>; doneByBranch: Map<string, MeterBall[]>; audit: MeterBall[] } = { byBranch: new Map(), doneByBranch: new Map(), audit: [] };
let placedRuns = new Set<string>();
// the machine a run's `where` names, set per full render from the machines Geräte draws (this one,
// the helpers by name); an offer no helper took yet ("unclaimed") has none
let runMachine: (b: MeterBall) => { glyph: IconName; name: string } | null = () => null;
function readRunsHere(): void {
  const byBranch = new Map<string, MeterBall[]>(), doneByBranch = new Map<string, MeterBall[]>(), audit: MeterBall[] = [];
  // a branch places a run only where it names exactly one lane on this board: one shared by two
  // projects' worktrees (or "main") stays in the Prüfungen block
  const seen = new Map<string, number>();
  for (const R of workplaces?.repos ?? []) for (const w of R.worktrees ?? [])
    if (!w.primary && w.branch) seen.set(w.branch, (seen.get(w.branch) ?? 0) + 1);
  for (const b of meterModel().balls) {
    if (b.station === "done") {
      if (b.kind !== "post-land check" && b.branch && (seen.get(b.branch) ?? 0) === 1)
        doneByBranch.set(b.branch, [...(doneByBranch.get(b.branch) ?? []), b]);
      continue;
    }
    // the check after the land measures a repo's main, whatever branch its ball names: it goes by repo
    if (b.kind === "post-land check") audit.push(b);
    else if (b.branch && (seen.get(b.branch) ?? 0) <= 1) byBranch.set(b.branch, [...(byBranch.get(b.branch) ?? []), b]);
  }
  // which stem the audit belongs to is #stemAudit's: the server names its repo by basename
  runsHere = { byBranch, doneByBranch, audit };
  placedRuns = new Set();
}
// ONE LINE PER RUN (owner 2026-10-08: the three-line stacks „[Zitat entfernt]“
//  said one thing three times): the kind's glyph in the state's colour, then one sentence —
// "Landprüfung 3:21 von ~8:00", "Prüflauf wartet hinter 2A". The branch and the machine are the
// row's above it, so they stand in the title only.
function runSentence(b: MeterBall): string {
  // a queued run is a run that waits — the state says the waiting, the kind need not say it again
  const kind = b.kind === "queued check run" ? CHECK_KIND.run : meterKind(b.kind).label;
  // what it works through, unless it only repeats the state ("waiting behind 2A" carries the wait),
  // the stem it measures ("main@…" under main) or a lone place in a line of one
  const what = b.what && !/^pid \d+$/.test(b.what) && !/^main@/.test(b.what) ? b.what.replace(/\s*·\s*place 1\/1$/, "") : "";
  // ended in the server's last minutes (only the diamond says these): how, and how long ago
  if (b.station === "done") {
    const ago = b.at > 0 ? ` ${mmss(serverClock() - b.at)} ago` : "";
    return `${kind} ${b.tone === "ok" ? RUN_STATE.passed : b.tone === "red" ? RUN_STATE.failed : RUN_STATE.noResult}${ago}${what ? ` · ${what}` : ""}`;
  }
  if (b.station === "wait") {
    // "waiting behind 2A" names a lane; behind a run nobody named, only the place in the line is a fact
    const q = /^waiting behind (.+?)(?:\s*·\s*place (\d+)\/\d+)?$/.exec(what);
    if (q) return `${kind} ${waitWord(b)}${!waitBehind(b) && q[2] ? ` · place ${q[2]}` : ""}`;
    return `${kind} ${/^waiting\b/.test(what) ? what : [RUN_STATE.waiting, what].filter(Boolean).join(" · ")}`;
  }
  // running: the word, the clock and, where past runs were measured, the usual length — "running 3:21
  // of ~8:00" (owner 2026-10-09: „[Zitat entfernt]“ — a bare clock said nothing). The machine
  // is its glyph, or its name beside the sentence where the line has room for it.
  const ms = b.at > 0 ? serverClock() - b.at : 0;
  const e = b.expect && b.expect.p50 >= 1000 ? b.expect : null;
  const clock = b.at > 0 ? ` ${mmss(ms)}` : "";
  const usual = e && b.at > 0 ? (ms > e.p90 ? `, longer than usual (~${mmss(e.p50)})` : ` of ~${mmss(e.p50)}`) : "";
  return `${kind} ${RUN_STATE.running}${clock}${usual}${what ? ` · ${what}` : ""}`;
}
// WHOM A QUEUED RUN WAITS BEHIND, by the lane's band name ("0A") — the queue names it so
// (src/suitemeter.ts#suiteMeter); null behind a run nobody named
function waitBehind(b: MeterBall): string | null {
  const q = b.station === "wait" ? /^waiting behind (\d+[A-Z])(?:\s*·|$)/.exec(b.what) : null;
  return q ? q[1] : null;
}
const waitWord = (b: MeterBall): string => { const a = waitBehind(b); return a ? `${RUN_STATE.waiting} behind ${a}` : RUN_STATE.waiting; };
// THE LANE A RUN BELONGS TO, said as the board says a lane (note cdf43028, owner 26.09.: „[Zitat entfernt]“
// ): its band name, then its Kurztitel — a hand label
// where no title was derived, the branch's words where the label is only the dispatcher's "⎇ <branch>".
// The branch's four hex stand in the row's tooltip; a session without a band keeps its label as before.
function runWho(s: SlotInfo, band: string | undefined): HTMLElement {
  const who = el("span", "who");
  const title = s.worktree ? s.taskTitle ?? null : null;
  const name = !band ? nameWithoutModel(s) : title ? shortTitle(title)
    : !s.label || s.label.startsWith("⎇ ") ? laneWords(s.worktree?.branch ?? null) : nameWithoutModel(s);
  who.append(el("span", "ref", band ?? String(s.id)), ` ${name}`);
  return who;
}
// "e2e-isolated" broke at its hyphen on the phone: a short hyphenated word stays one word (a long
// one — a branch — may still break, or it would run the column off the side). A pass over the
// sentence the row already holds, so the row stays built from runSentence (e2e/lane-suite.ts LS.meter).
function keepShortHyphenWords(w: HTMLElement): void {
  const parts = (w.textContent ?? "").split(/(\S+-\S+)/);
  w.replaceChildren(...parts.flatMap((part, i) => !part ? [] : [i % 2 && part.length <= 16 ? el("span", "nw", part) : part]));
}
// `place` marks the run as standing at a lane: the Prüfungen block then leaves it out. The block's
// own lines never mark — it is repainted in place every poll, and a mark there hid its rows on the
// next repaint and drew them again on the one after (the block jumped open and shut every 2 s)
function runLines(balls: MeterBall[], place = true): HTMLElement[] {
  return balls.map((b) => {
    if (place) placedRuns.add(b.key);
    const say = runSay(b);
    const line = el("div", "zd run");
    line.dataset.tone = say.state.tone;
    line.dataset.station = b.station;
    const tx = el("span", "tx");
    // a waiting run shows the clock, a running one the shield — never the tick, which reads as "passed"
    const g = el("span", "g");
    g.appendChild(icon(b.station === "wait" ? "clock" : "shield"));
    const w = el("span", "w", runSentence(b));
    keepShortHyphenWords(w);
    tx.append(g, w);
    // WHERE IT RUNS, as the machine's glyph behind the sentence (owner 2026-10-08: „[Zitat entfernt]“
    // ): the glyph Geräte draws for that machine, its name
    // on hover and to VoiceOver; nothing where no machine has the run yet
    const at = runMachine(b);
    if (at) {
      const d = el("span", "dv");
      d.appendChild(icon(at.glyph));
      d.title = `running on ${at.name}`;
      d.setAttribute("role", "img");
      d.setAttribute("aria-label", d.title);
      tx.appendChild(d);
    }
    line.appendChild(tx);
    line.title = `${meterKind(b.kind).label} · ${b.branch ?? "branch not reported"} · ${meterState(b)} · ${b.where} · ${meterKind(b.kind).title}`;
    return line;
  });
}
// the shared lock of this machine as a state chip: free, taken, stuck, closed by hand, not reported
function lockState(m: ReturnType<typeof meterModel>): MachineState {
  const lk = gateInfo?.lock ?? null;
  const held = lk ? agoEn(lk.ageMs ?? lk.heldMs) : "";
  const holder = m.balls.find((b) => b.station === "run");
  const by = holder ? ` — held by ${holder.name}` : "";
  switch (m.lock) {
    case "overdue": return { tone: "wait", word: `Lock stuck for ${held}`, title: `A run holds the lock longer than any run here needs${by}` };
    case "held": case "stale": return { tone: "live", word: "Lock taken", title: `A check run has held this machine's shared lock for ${held}${by}` };
    case "parked": return { tone: "wait", word: "locked by hand", title: "The lock was set by hand — no run starts until it is released" };
    case "unknown": return { tone: "off", word: "Lock: holder unknown", title: "The lock is set, but who holds it is not on record" };
    case "free": return { tone: "still", word: "Lock free", title: "No check run holds this machine's shared lock" };
    default: return { tone: "off", word: "not reported", title: "This server sends no reading of the lock" };
  }
}
export function runRows(noPane: boolean): HTMLElement {
  const m = meterModel();
  const box = el("div", "rkruns");
  box.dataset.noPane = noPane ? "1" : "";
  // MINIMAL (owner 2026-10-09 in the test instance: „[Zitat entfernt]“
  // ):
  // every run that runs or waits, one line each — the diamond and what it is, the machine it is on,
  // whose it is. How far it is stands in the title; at its lane the run is the diamond on the way back.
  // Nothing runs: the block is gone. The lock gets a row only when it needs someone.
  const rank: Record<MeterStation, number> = { run: 0, helper: 1, wait: 2, done: 3 };
  const open = [...m.balls].filter((b) => b.station !== "done").sort((x, y) => rank[x.station] - rank[y.station] || x.at - y.at);
  const bands = laneBandNames(stacksOf());
  // THE BLOCK FOLDS (owner 2026-10-09 in the test instance: „[Zitat entfernt]“
  // ): closed by default — at its lane a run is the diamond already — it keeps ONE line, a
  // diamond per run and how many run and wait, each run's sentence on hover; a tap on that line or on
  // the block's head opens one line per run. Which is open is remembered per browser
  // (fleet.board.folds). The lock's row stays out of the fold: it stands only when it needs someone.
  const unfolded = boardFolds.has(RUNS_FOLD);
  if (!unfolded && open.length) box.appendChild(runsSummary(open));
  if (unfolded) for (const b of open.slice(0, METER_ROWS_MAX)) {
    const line = el("div", "zd run free");
    line.dataset.station = b.station;
    line.dataset.gate = b.station === "wait" ? "queue" : "run";
    const tx = el("span", "tx");
    const kind = b.kind === "queued check run" ? CHECK_KIND.run : meterKind(b.kind).label;
    const at = runMachine(b);
    const dv = el("span", "dv");
    if (at) dv.append(icon(at.glyph), `on ${at.name}`);
    else dv.appendChild(el("span", "q", b.station === "wait" ? "on no device yet" : `place: ${b.where || "not reported"}`));
    const s = b.slot !== null ? fleet[b.slot - 1] : undefined;
    const who = s?.cwd ? runWho(s, bands.get(s.id)) : el("span", "who", b.branch ? laneWords(b.branch) : b.kind === "post-land check" ? "main" : "no session");
    tx.append(el("span", "gd"), el("span", "w", `${kind} ${b.station === "wait" ? waitWord(b) : RUN_STATE.running}`), dv, who);
    line.appendChild(tx);
    line.title = `${b.title ? `${b.title} — ` : ""}${runSentence(b)} · ${b.branch ?? "branch not reported"} · ${b.where} · ${meterKind(b.kind).title}`;
    const slot = b.slot;
    if (slot !== null && s?.cwd) rowTarget(line, () => showSlot(slot));
    box.appendChild(line);
  }
  const lock = lockState(m);
  if (m.lock === "overdue" || m.lock === "parked" || m.lock === "unknown") {
    const row = el("div", "zr mach lock");
    row.dataset.tone = lock.tone;
    const fx = el("span", "fx");
    fx.appendChild(icon("shield"));
    row.append(fx, el("span", "nm", "Check lock"), stateChip(lock));
    row.title = lock.title;
    box.appendChild(row);
  }
  return box;
}
export const METER_ROWS_MAX = 6;
const RUNS_FOLD = "pruefungen";
const RUNS_OPEN_HINT = "Click opens each check as a line of its own";
function toggleRuns(): void {
  if (boardFolds.has(RUNS_FOLD)) boardFolds.delete(RUNS_FOLD); else boardFolds.add(RUNS_FOLD);
  prefSet("fleet.board.folds", JSON.stringify([...boardFolds]));
  void renderBoard();
}
// the closed block's one line: a diamond per run in its state, then "2 running · 1 waiting"
function runsSummary(open: MeterBall[]): HTMLElement {
  const line = el("div", "zd run sum");
  const tx = el("span", "tx");
  const ds = el("span", "gds");
  for (const b of open.slice(0, METER_ROWS_MAX)) {
    const q = el("span", "gq");
    q.dataset.gate = b.station === "wait" ? "queue" : "run";
    q.appendChild(el("span", "gd"));
    ds.appendChild(q);
  }
  const run = open.filter((b) => b.station !== "wait").length, wait = open.length - run;
  tx.append(ds, el("span", "w", [run ? `${run} ${RUN_STATE.running}` : "", wait ? `${wait} ${RUN_STATE.waiting}` : ""]
    .filter(Boolean).join(" · ")));
  line.appendChild(tx);
  line.title = [...open.map((b) => { const at = runMachine(b); return `${runSentence(b)}${at ? ` · on ${at.name}` : ""}`; }),
    RUNS_OPEN_HINT].join("\n");
  rowTarget(line, toggleRuns);
  line.setAttribute("aria-expanded", "false");
  return line;
}
// the polls call this: the strip and its panel are repainted in place, the rest of the column stays
export function renderSuiteMeter() {
  if (!boardOpen) return;
  perfRebuild("renderSuiteMeter");
  const runs = boardBody.querySelector<HTMLElement>(".ranke .rkruns");
  if (runs) runs.replaceWith(runRows(runs.dataset.noPane === "1"));
}

// --- is a deploy due? ------------------------------------------------------------------------
// Landing is not deploying, and building is not landing. Both facts existed already but were
// served only to the steward, so the owner — the only principal who restarts srv or runs the
// build — could not see either. Drawn ONLY when something is actually due: an idle fleet gets no
// row at all, and an UNKNOWN (null) draws nothing either, because a permanent "can't tell" line
// is the same noise the suite-gate line just had removed.
export interface DeployGapInfo { bootHead: string | null; head: string | null; behindCount: number | null; codeBehind: boolean | null }
export interface BundleStaleInfo {
  appJsMtime: number | null; shareJsMtime: number | null; helperJsMtime: number | null;
  srcNewestMtime: number | null; stale: boolean | null;
}
export let deployGapInfo: DeployGapInfo | null = null;
export let bundleStaleInfo: BundleStaleInfo | null = null;
// --- has the server thrown? -------------------------------------------------------------------
// The counterpart to the audit trail: that one shows what Fleet DID, this one what broke while it
// was doing it. Until now the only channel was an unrotated server.log that e2e-stage.sh calls
// "a server.log nobody reads" in its own source — so a 500 on a button press left no mark anywhere
// the owner looks. Machine-level like the gate and deploy lines, drawn ONLY when something has
// actually thrown, and tolerant on the wire: an older server sends no `errors` at all and this
// must then be absent, never "no errors" — which is a claim, and one nothing here has measured.
export interface ErrorsInfo {
  total: number; distinct: number; since: number;
  last: { at: number; where: string; msg: string; n: number };
}
export interface ErrorRow { where: string; msg: string; first: number; last: number; n: number }
export let errorsInfo: ErrorsInfo | null = null;
// the rows, fetched on the click that asks for them and never from the 3 s repaint (the rule
// /api/sessions was shrunk for). `null` = not asked yet. The cache key carries `since` as well as
// `total` BECAUSE the list dies with the server: after a restart both counters start again from
// zero, so a total alone would match a stale cache and paint a dead process's errors as live ones.
export let errorRows: { key: string; rows: ErrorRow[]; err: string | null } | null = null;
export const errorKey = (e: ErrorsInfo): string => `${e.since}:${e.total}`;
export let errorsOpen = false;
export function errorsSection(): HTMLElement | null {
  const e = errorsInfo;
  if (!e) return null;
  // a line in the flow (G2.1, §4a `alarm`): a red dot, how many since when, the last one under it;
  // a click lists every row (fetched on the click, never from the repaint)
  const sec = el("div", "bsec berrs");
  const many = e.total !== e.distinct;
  // a BUTTON, not a clickable div: the error line is one of the column's actions (D-4 rest).
  // Inline rather than a new class: the stylesheet lives in public/index.html, which the demo repo
  // derives its own page from (CLAUDE.md) — and a lane cannot build that repo to check it. One
  // property here has no reach outside this file; a rule there has one nothing available can test.
  const head = el("button", "bstate errrow") as HTMLButtonElement;
  head.append(el("span", "dot bad"), el("span", "t", `${e.total} server ${e.total === 1 ? "error" : "errors"}${many ? ` · ${e.distinct} distinct` : ""} since ${fmtTs(e.since)}`));
  const chev = icon("chevron");
  chev.classList.add("chev");
  head.appendChild(chev);
  head.setAttribute("aria-expanded", String(errorsOpen));
  head.style.cssText =
    "background:none;border:0;padding:0;width:100%;text-align:left;font:inherit;color:inherit;cursor:pointer;";
  head.title = "Thrown since this server started. Kept in memory only — a restart empties the list,"
    + " the history stays in server.log. Click shows every line.";
  head.onclick = () => {
    errorsOpen = !errorsOpen;
    // one fetch per (boot, total): reopening after nothing new happened costs no request
    if (errorsOpen && errorRows?.key !== errorKey(e)) {
      void api("/api/errors").then(async (r) => {
        if (!r.ok) { errorRows = { key: errorKey(e), rows: [], err: `HTTP ${r.status}` }; void renderBoard(); return; }
        const j = (await r.json()) as { errors?: ErrorRow[] };
        errorRows = { key: errorKey(e), rows: j.errors ?? [], err: null };
        void renderBoard();
      }).catch(() => {
        // an unhandled rejection here used to leave the section open and empty forever
        errorRows = { key: errorKey(e), rows: [], err: "the server could not be reached" };
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
    if (errorRows?.err) sec.appendChild(el("div", "bstate", `The error list could not be read — ${errorRows.err}.`));
    const live = errorRows?.key.startsWith(`${e.since}:`) ? errorRows.rows : [];
    for (const r of live) {
      const row = el("div", "bidmeta", `${r.where} · ${r.msg}${r.n > 1 ? ` ×${r.n}` : ""} · ${fmtTs(r.last)}`);
      row.title = r.n > 1 ? `${r.n}× — first ${fmtTs(r.first)}, last ${fmtTs(r.last)}` : `once, ${fmtTs(r.first)}`;
      sec.appendChild(row);
    }
  }
  return sec;
}

let fxAfterPaint: (() => void) | null = null;
export function takeFxAfterPaint(): (() => void) | null {
  const fn = fxAfterPaint;
  fxAfterPaint = null;
  return fn;
}
export function fileTreeSection(slot: number, cwd: string): HTMLElement {
  const sec = el("div", "bsec");
  const hd = el("div", "bwthead");
  const t = fxTree.get(cwd);
  if (t && !("error" in t)) {
    const big = el("button", "bbtn quiet", "Open explorer");
    big.title = "open the file explorer in a window — the place to actually read one";
    big.onclick = () => openExplorer(slot, cwd);
    hd.appendChild(big);
    const again = el("button", "bbtn quiet") as HTMLButtonElement;
    // a glyph, not a word (G0.6): the sentence lives on title AND aria-label, because an icon
    // button has no text for a screen reader to read out. The click behaviour is unchanged.
    again.appendChild(icon("reload"));
    again.title = "re-read the tree (a new file only appears after this)";
    again.setAttribute("aria-label", "re-read the tree (a new file only appears after this)");
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
  if (t.capped) sec.appendChild(el("div", "bstate", `showing the first ${t.files.length} of ${t.total}`));
  const box = el("div", "fxtree");
  // the box this pass REPLACES — the only place the caret and the focus still exist
  const prev = fxInputEl.get(cwd);
  const refocus = !!prev && document.activeElement === prev;
  const caret = prev ? (prev.selectionStart ?? prev.value.length) : 0;
  const inp = fxSearchInput(cwd, () => repaint(), false);
  fxInputEl.set(cwd, inp);
  sec.appendChild(inp);
  const repaint = () => {
    const v = fxView(cwd, t);
    paintTree(box, fxTreeOf(v.paths), {
      open: fxOpenSet(cwd),
      onPick: (rel) => openExplorer(slot, cwd, rel),
      picked: () => null,
      query: fxQuery.get(cwd) ?? "",
      all: v.paths, capped: t.capped, shown: t.files.length, total: t.total,
      status: v.status, onDrag: (rel, e) => fxStartDrag(slot, rel, e),
    });
  };
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

// The explorer window, arrangement A "Werkbank" (owner's pick 2026-09-24; mockup
// docs/design/datei-explorer/entwurf.html?f=a): it takes the screen the way the queue does, the
// tree on the left and the file on the right at full height. It is the same shell every other
// browse-and-inspect surface uses, and the file is showFileView — the viewer the diff window, the
// picker and the commit lens share. This window adds only its own file HEAD (the path, which
// version, the jump to what changed) and asks the viewer for line numbers.
//
// READ-ONLY (X1). Nothing here writes: the ✎ under a file is the viewer's existing edit stair,
// unchanged, and New/Rename/Move/Delete wait for X3 and its dialog.

// --- THE OWNER'S NOTEPAD on a worktree (owner 2026-09-23/24: „[Zitat entfernt]“
// ). ONE plain free text per
// worktree path — no Markdown, no history, no second comment rail beside Task.comments — stored
// server-side on the PATH, so it rides a review park, a resume of the same tree and a restart, and
// a tree that leaves the board takes it along. Drawn in the board's detail view above the suite
// area for the focused lane, and under a parked candidate's rows in the Lanes list (a parked
// candidate holds no slot, so it has no board column of its own).
export const WORKTREE_NOTE_MAX = 20_000; // the server's cap (server.ts#WORKTREE_NOTE_MAX), restated for the live counter
export const notepadDraft = new Map<string, string>(); // path → unsent text — survives every board re-render
export function notepadBlock(repo: string, w: WtRow): HTMLElement {
  // COMPACT (R2, §3 item 6): two lines high while empty, growing while one writes; "Notiz sichern"
  // only while there is an unsaved change, the counter only from 80 % of the server's cap
  const saved = w.notepad ?? "";
  const box = el("div", "bnote");
  const ta = document.createElement("textarea") as HTMLTextAreaElement;
  ta.className = "bnoteta";
  ta.value = notepadDraft.get(w.path) ?? saved;
  ta.rows = 2;
  ta.placeholder = "A note on this work — it stays when the work pauses and goes on";
  const foot = el("div", "bnotefoot");
  const meta = el("span", "m");
  const err = el("div", "brefusal");
  const save = el("button", "bbtn quiet bnotesave", "Save note") as HTMLButtonElement;
  save.type = "button";
  const grow = () => { ta.style.height = "auto"; ta.style.height = `${Math.min(ta.scrollHeight + 2, 320)}px`; };
  const sync = () => {
    const t = ta.value;
    notepadDraft.set(w.path, t);
    const over = t.length > WORKTREE_NOTE_MAX;
    const dirty = t !== saved;
    const count = t.length >= WORKTREE_NOTE_MAX * 0.8 ? `${t.length} / ${WORKTREE_NOTE_MAX}` : "";
    meta.textContent = over ? `${count} — over the limit, shorten it (the server takes no more)`
      : [dirty ? "not saved" : saved ? "saved" : "", count].filter(Boolean).join(" · ");
    save.hidden = !dirty;
    save.disabled = over;
    foot.hidden = !meta.textContent && save.hidden;
    grow();
  };
  ta.addEventListener("input", sync);
  save.title = "Saves the text at this worktree's path — it stays through parking, resuming and restarts";
  save.onclick = async () => {
    save.disabled = true;
    save.textContent = "saving…";
    err.textContent = "";
    try {
      const r = await post("/api/worktrees/note", { repo, path: w.path, text: ta.value });
      if (!r.ok) {
        err.textContent = ((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Saving failed";
        return;
      }
      notepadDraft.delete(w.path); // the board now carries the saved text — the draft has served
      void renderBoard();
    } finally {
      save.disabled = false;
      save.textContent = "Save note";
    }
  };
  foot.append(meta, save);
  box.append(ta, foot, err);
  sync();
  // the height is measured once the textarea is in the document
  requestAnimationFrame(grow);
  return box;
}

// WHAT FINDS A FOCUSED CONTROL'S SUCCESSOR after a repaint: its tag, its class, its label and its
// text. An icon button has no text, so its aria-label joins the key — without it the Geräte ⓘ and a
// project's + were one key ("rk-btn quiet ib"), the restore focused the + at the top, and the column
// jumped there on every tick (owner 2026-10-09: „[Zitat entfernt]“
// ). A toggle's own "on" stays out, or the button just switched has no successor.
function boardFocusKey(a: HTMLElement): string {
  const cls = (a.getAttribute("class") ?? "").split(" ").filter((c) => c && c !== "on").join(" ");
  return `${a.tagName}\u0000${cls}\u0000${a.getAttribute("aria-label") ?? ""}\u0000${(a.textContent ?? "").slice(0, 40)}`;
}
export async function renderBoard() {
  // never rebuild the board out from under an open note edit (the sidebar rename precedent): the
  // draft map keeps the TEXT across re-renders, this check keeps the CARET — a board tick that
  // lands mid-typing simply waits for the next one
  if (document.activeElement instanceof HTMLTextAreaElement && boardBody.contains(document.activeElement)) return;
  // a render requested while one is in flight (e.g. focus moved mid-fetch) must not be
  // dropped — remember it and re-run once the current pass finishes
  if (boardBusy) { boardAgain = true; return; }
  // boardOpen is the phone's info WINDOW too — the #board element lives inside it there, so the
  // same render fills the same element and the old "empty on mobile" early return is gone
  if (!boardOpen) return;
  boardBusy = true;
  try {
    const slot = panes[focused]?.slot;
    const s = slot ? fleet[slot - 1] : undefined;
    if (!slot || !s?.cwd) {
      // the alarms are about the MACHINE, not the focused lane — they must not disappear just
      // because the pane under the cursor is empty; the Arbeitsorte and their checks strip neither
      // (rechter-tab-notiz.md §4a `leer`). The helper devices are counted in that strip.
      const er = errorsSection();
      const pla0 = plaBoardCard();
      const plaTop = pla0?.dataset.place === "top" ? [pla0] : [], plaQuiet = pla0 && !plaTop.length ? [pla0] : [];
      // the same scroll rescue the main path has, or the column jumped to the top on every tick
      const y0 = boardBody.scrollTop;
      boardPop = null;
      perfRebuild("renderBoard");
      const next = [...plaTop, ...(er ? [er] : []), arbeitsorteSection(null, null), ...plaQuiet, el("div", "bempty bnopane", "Pick a pane to see its session.")];
      boardBody.replaceChildren(...next);
      boardBody.scrollTop = y0;
      return;
    }
    const [briefRes, outlineRes, wtRes, mgRes] = await Promise.all([
      api(`/api/slots/${slot}/brief`), pollOutline(slot),
      s.git ? api(`/api/slots/${slot}/worktrees`) : Promise.resolve(null),
      s.worktree ? api(`/api/slots/${slot}/merge`) : Promise.resolve(null),
    ]);
    const { prompts, err: outlineErr } = outlineRes;
    const briefBody = (await briefRes.json().catch(() => null)) as (BriefInfo & BriefNoGit) | null;
    const brief = briefRes.ok ? briefBody : null;
    // a plain folder without git is an ordinary session, not a failed read: the server says which
    // with `git: "none"` (server.ts#cwdGitBody) and still serves the session's non-git half
    const noGit = !briefRes.ok && briefBody?.git === "none" ? briefBody : null;
    // what the head and the setup block read, git or not — never a git fact
    const facts: Pick<BriefInfo, "sessionStart" | "setup" | "succession"> | null = brief ?? noGit;
    // the brief is one of the two places the board SEES commit shas — remember them so transcript
    // text citing a prefix of any of these can hover (the other source is fleet[].taskHead, live)
    if (brief) rememberShas(brief.head, ...(brief.commits ?? []).map((c) => c.hash),
      ...(brief.repoCommits ?? []).map((c) => c.hash));
    // WHY it is null, kept for the reader: a failed read used to remove Changes, History and Lanes
    // with no word at all, which is indistinguishable from a session that has done nothing.
    const briefErr = briefRes.ok || noGit ? null : briefBody?.error ?? `HTTP ${briefRes.status}`;
    const wts = wtRes?.ok ? ((await wtRes.json()) as WtInfo) : null;
    const wtErr = !wtRes || wtRes.ok ? null
      : ((await wtRes.json().catch(() => null)) as { error?: string } | null)?.error ?? `HTTP ${wtRes.status}`;
    const mg = mgRes?.ok ? ((await mgRes.json()) as MergeState) : null;
    if (mg?.running) mergeWatch.add(slot);
    if (boardPop && boardPop.slot !== slot) boardPop = null; // it was another session's menu
    // the focus moved to another pane while we were fetching — this render describes
    // the wrong slot; drop it (the re-run below paints the right one)
    if (panes[focused]?.slot !== slot) { boardAgain = true; return; }
    // rebuild in place but keep the reading position — AND the keyboard focus. Every node here
    // is new on every tick, so a focused control was dropped to <body> three times a minute; a
    // stable key (boardFocusKey) finds its successor after the swap.
    // Both are read HERE, before the first section is built: a section that keeps its element
    // across ticks takes it out of the live
    // column while the new nodes are assembled, the column is that much shorter for a moment, and
    // a scrollTop read then is already clamped — the restore jumped the column under the pointer.
    // From here to the swap nothing awaits, so the values are still the reader's at the swap.
    const y = boardBody.scrollTop;
    const focusKey = ((): string | null => {
      const a = document.activeElement;
      if (!(a instanceof HTMLElement) || !boardBody.contains(a)) return null;
      return boardFocusKey(a);
    })();
    const nodes: HTMLElement[] = [];
    // THE COLUMN TELLS ONE STORY, top to bottom (docs/design/rechter-tab-notiz.md §3–§3d, Variante 3A,
    // owner-Ja 2026-10-05: „[Zitat entfernt]“): alarms only when due → ARBEITSORTE
    // (every worktree, the checks strip in its head, a due restart in its Live row) → THIS SESSION
    // (name, state, its lane's values, the handover line) → CHANGES with Land lane as the one primary
    // action → the NOTEPAD → HISTORY (three commits, the rest behind one button) → MORE (Setup, Rechte,
    // Files, Your prompts as tabs). Every function of the former column has a place (§3d's table).
    // 0 — ALARMS, only when due: the check after the land (something failed ON MAIN), then what the
    // server has been throwing. The due restart moved into the Arbeitsorte's Live row (§3, I3).
    // WHAT NEEDS YOU comes first, and only that (owner 2026-10-08): an alarm a session, the
    // Program's inbox or a judgement already holds recedes to one quiet line under the Arbeitsorte
    const pla0 = plaBoardCard();
    const plaTop = pla0?.dataset.place === "top";
    if (pla0 && plaTop) nodes.push(pla0);
    const esec0 = errorsSection();
    if (esec0) nodes.push(esec0);
    // 1 — ARBEITSORTE: the selected session's repo as its git structure, the checks, the machines this server knows
    // (cards e66909b1, abe74821, owner Z131); the former lane list and test-instance card live in it
    const ranke = arbeitsorteSection(slot, wts);
    nodes.push(ranke);
    if (pla0 && !plaTop) nodes.push(pla0);
    // for a lane, ahead/behind are vs the base branch (from the brief); for a non-lane session, vs
    // the upstream (from the sessions-poll gitInfo)
    const ahead = brief ? (brief.laneScoped ? brief.ahead : (s.git?.ahead ?? 0)) : 0;
    const behind = brief ? (brief.laneScoped ? brief.behind : (s.git?.behind ?? 0)) : 0;
    const c: BoardCtx = { s, slot, brief, noGit, facts, mg, wts, ahead, behind,
      own: ownWorkplace(s), prompts, outlineErr };
    // 2 — THIS SESSION
    const idsec = sessionSection(c);
    nodes.push(idsec);
    if (noGit) {
      // NOT-APPLICABLE, drawn once and quietly: no fail styling, no "keeps trying" — nothing is
      // wrong, the folder simply has no repository for Changes, History, Files or Lanes to read
      const ng = el("div", "bsec");
      ng.appendChild(sectionHead(SECTION.changes, "session"));
      const e = el("div", "bempty", "No git in this folder — changes, history and lanes exist only in a repository.");
      e.title = `${s.cwd} is a plain folder; the session, its prompts and its setup are read as usual`;
      ng.appendChild(e);
      nodes.push(ng);
    }
    if (briefErr) {
      const fail = el("div", "bsec bfail");
      fail.appendChild(sectionHead("Changes, history and lanes are missing", "session"));
      fail.appendChild(el("div", "bstate", `The session brief could not be read — ${briefErr}.`));
      // the server names the cause (folder gone, unreadable, git error — server.ts#cwdGitBody), so
      // the sentence no longer guesses at it; a plain folder never reaches here (noGit above)
      fail.appendChild(el("div", "bempty", "This is a failed read, not an empty session. The column keeps trying."));
      nodes.push(fail);
    }
    // 3 — CHANGES: the uncommitted tree, Commit, and on a lane Land lane with ⋯ beside it
    if (brief) {
      const work = changesSection(c, brief);
      const ub = handoverUnderChanges(c) ? handoverBlock(c) : null;
      if (ub) work.appendChild(ub);
      nodes.push(work);
    }
    // 4 — MORE ABOUT THIS SESSION: what is fixed at its founding or reached for rarely, as tabs with
    // a one-line summary each (G3.2); which tab is open is remembered per browser (src/prefs.ts). It
    // stands above the notepad and History (owner 2026-10-09: „[Zitat entfernt]“
    // )
    const msec = moreSection(c);
    nodes.push(msec);
    // 5 — THE NOTEPAD, the owner's free text on THIS lane's worktree (owner: it stays visible). Drawn
    // from the lanes read alone, so it stands even when the brief failed; a repo session (the primary
    // checkout is no board row) and a failed lanes read draw none.
    {
      const ownWt = wts?.worktrees.find((x) => x.path === s.cwd);
      if (ownWt && wts) {
        const noteSec = el("div", "bsec bnotesec");
        noteSec.appendChild(sectionHead(SECTION.notepad, "repo"));
        noteSec.appendChild(notepadBlock(wts.repo, ownWt));
        nodes.push(noteSec);
      }
    }
    // 6 — HISTORY: the three newest commits, the full list behind one button
    if (brief) {
      const csec = historySection(c, brief);
      nodes.push(csec);
      // the repo's lane map lives in the Arbeitsorte; what stays here is the one sentence when the
      // focused repo's lane list could not be read, since the close controls of its orphans hang on it
      if (wtErr) {
        const lfail = el("div", "bsec bfail");
        lfail.appendChild(sectionHead("Lanes", "repo"));
        lfail.appendChild(el("div", "bstate", `The lane map could not be read — ${wtErr}.`));
        nodes.push(lfail);
      }
    }
    perfRebuild("renderBoard");
    boardBody.replaceChildren(...nodes);
    boardBody.scrollTop = y;
    const opened = popScroll && !isMobile() ? boardBody.querySelector<HTMLElement>(".bpop") : null;
    if (opened) { popScroll = false; opened.scrollIntoView({ block: "nearest" }); }
    if (popFocus) { boardBody.querySelector<HTMLElement>(`button[data-pop="${popFocus}"]`)?.focus(); popFocus = null; }
    if (focusKey) {
      // inputs too (K5): a branch card's "Punkt hinzufügen" keeps the focus over the write's repaints,
      // so the second point typed after Enter lands in the field (Critic B4)
      for (const cand of boardBody.querySelectorAll<HTMLElement>("button, [tabindex], input")) {
        if (boardFocusKey(cand) !== focusKey) continue;
        // the reading position was put back above — a focus that scrolled to its button would undo it
        cand.focus({ preventScroll: true });
        break;
      }
    }
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

// --- THE INFO COLUMN BELOW THE ARBEITSORTE (docs/design/rechter-tab-notiz.md §3, §3b, §4; cards R1–R3,
// Variante 3A). One context per repaint, built once in renderBoard, handed to each section.
interface BoardCtx {
  s: SlotInfo; slot: number;
  brief: BriefInfo | null; noGit: BriefNoGit | null;
  facts: Pick<BriefInfo, "sessionStart" | "setup" | "succession"> | null;
  mg: MergeState | null; wts: WtInfo | null;
  ahead: number; behind: number;
  // the focused lane's own row of the last Arbeitsorte read — its checks and its target
  own: WorkplaceRow | null;
  prompts: string[]; outlineErr: string | null;
}
// a section head: the title, and WHOSE fact it is as the head's hover (G0.5: no reach word in the
// visible text; the closed vocabulary of SCOPE_TITLE stays the sentence)
export function sectionHead(title: string, scope: BoardScope): HTMLElement {
  const h = el("h3", "", title);
  h.dataset.scope = scope;
  h.title = SCOPE_TITLE[scope];
  return h;
}
function ownWorkplace(s: SlotInfo): WorkplaceRow | null {
  if (!s.worktree || !workplaces) return null;
  for (const R of workplaces.repos) for (const w of R.worktrees ?? []) if (w.path === s.cwd) return w;
  return null;
}
// a label/value row (the draft's .kv): the label quiet on the left, the value on the right
function kvRow(label: string, value: (Node | string)[], cls = ""): HTMLElement {
  const r = el("div", `bkv${cls ? ` ${cls}` : ""}`);
  r.appendChild(el("span", "k", label));
  const v = el("span", "v");
  v.append(...value);
  r.appendChild(v);
  return r;
}
// a glyph button with its sentence on hover AND as its accessible name (G1.1)
function glyphBtn(name: IconName, label: string, title: string, run: () => void): HTMLButtonElement {
  const b = el("button", "bib") as HTMLButtonElement;
  b.type = "button";
  b.appendChild(icon(name));
  b.title = title;
  b.setAttribute("aria-label", label);
  b.onclick = run;
  return b;
}

// --- THE COLUMN'S TWO POPOVERS (G4.1): the session's ⋯ and the ⋯ beside Land lane (the handover settings left
// their popover for the session's „Übergabe“ block, K16 Teil 2). ONE state, bound to the slot it was opened on (a
// focus change must not hang one session's actions under another's name), registered with the board's one popover().
type BoardPopKind = "kopf" | "land";
export let boardPop: { kind: BoardPopKind; slot: number } | null = null;
// a popover just opened: bring it into the column's view once (the draft scrolls to its anchor);
// one just closed by Escape: its button takes the focus back once the column is repainted
let popScroll = false;
let popFocus: BoardPopKind | null = null;
function popTrigger(kind: BoardPopKind, slot: number, btn: HTMLButtonElement): HTMLButtonElement {
  const open = boardPop?.kind === kind && boardPop.slot === slot;
  btn.dataset.pop = kind;
  btn.classList.toggle("on", open);
  btn.setAttribute("aria-haspopup", "menu");
  btn.setAttribute("aria-expanded", String(open));
  btn.onclick = () => { boardPop = open ? null : { kind, slot }; popScroll = !open; void renderBoard(); };
  return btn;
}
// the panel: a menu at its button on the desktop, a sheet from the bottom on the phone (G4.1 mobil)
function popPanel(kind: BoardPopKind, rows: HTMLElement[], cls = ""): HTMLElement[] {
  const p = el("div", `bpop${cls ? ` ${cls}` : ""}`);
  p.dataset.pop = kind;
  p.setAttribute("role", "menu");
  p.append(...rows);
  const scrim = el("div", "bpopscrim");
  return [scrim, p];
}
function popItem(label: string, title: string, run: (b: HTMLButtonElement) => void, note = "", danger = false): HTMLButtonElement {
  const b = el("button", `bmenuitem${danger ? " danger" : ""}`) as HTMLButtonElement;
  b.type = "button";
  b.setAttribute("role", "menuitem");
  b.append(el("span", "t", label));
  if (note) b.append(el("span", "kk", note));
  b.title = title;
  b.onclick = () => run(b);
  return b;
}

// the label without the model it often ends in ("🎛 Orchestratorin · Opus 5.5" → "🎛 Orchestratorin"):
// only a LAST " · X" whose X is the slot's model name or a model family word is cut, so a role in
// the label ("Elektrowerkstatt · MAIN") stays
const MODEL_WORD = /^(opus|sonnet|haiku|fable|mythos|sol|luna|astra|terra|glm|gpt|codex|gemini)\b/i;
export function nameWithoutModel(s: SlotInfo): string {
  const label = laneLabel(s);
  const m = /^(.*\S)\s+·\s+([^·]+)$/.exec(label);
  if (!m) return label;
  const tail = m[2].trim();
  const named = s.model ? modelLabel(s.model).split(" · ")[0] : "";
  return tail === named || MODEL_WORD.test(tail) ? m[1] : label;
}

// --- 2 THIS SESSION (Variante A): the name with three glyph buttons and ⋯, the state, the waiting
// sentences only when true, the order — then the lane's own values (Branch, Landet in, Check or
// during a land its four steps), the handover line and what it belongs to.
function sessionSection(c: BoardCtx): HTMLElement {
  const { s, slot, brief, noGit, facts } = c;
  const idsec = el("div", "bsec bhead");
  const top = el("div", "bheadtop");
  // a task lane is "<Lane-Referenz> · <Kurztitel>"; the full title and the branch on hover
  const bands = laneBandNames(stacksOf());
  const headRef = s.worktree && s.taskTitle ? bands.get(s.id) : undefined;
  // the name WITHOUT the model a label often ends in (Konzept 1 §2: the model is no part of who —
  // the composer's switch carries it), wrapping instead of cut (owner 2026-10-08: „[Zitat entfernt]“)
  const headName = el("div", "bheadname", headRef ? laneDisplayName(headRef, s.taskTitle) : nameWithoutModel(s));
  headName.title = headRef && s.worktree ? `${s.taskTitle} — ${s.worktree.branch}` : laneLabel(s);
  top.appendChild(headName);
  // Rename, Share and Export stay VISIBLE at ONE place per session (row 11e541e0) — as glyphs with
  // their sentence on hover now (R1, G1.1); the rarer copies and the restart stay behind ⋯
  const sessName = s.label ?? baseName(s.cwd ?? "");
  top.append(
    glyphBtn("pencil", "Rename", "Rename this session — the name then stands in the sidebar.", () => {
      const row = slotsEl.querySelector(`[data-slot="${slot}"]`);
      if (row instanceof HTMLElement) startRename(row, s);
    }),
    glyphBtn("share", s.share ? "Shared" : "Share", s.share ? "This session is shared read-only — manage the link and the password."
      : "Share this session read-only — a link with a password.", () => openShareDlg(slot)),
    glyphBtn("export", "Export", "Export the session — the conversation or the screen; you choose the parts and the format.",
      () => { void openExportDlg(slot, sessName); }),
  );
  if (s.share) top.lastElementChild?.previousElementSibling?.classList.add("shared");
  const mbtn = el("button", "bib bheadmenu") as HTMLButtonElement;
  mbtn.appendChild(icon("dots"));
  mbtn.title = "More actions — copy, bring the session back";
  mbtn.setAttribute("aria-label", "More actions");
  top.appendChild(popTrigger("kopf", slot, mbtn));
  if (boardPop?.kind === "kopf" && boardPop.slot === slot) top.append(...popPanel("kopf", kopfItems(c)));
  idsec.appendChild(top);
  {
    const working = sessionActive(slot);
    const meta = el("div", "bheadmeta");
    meta.appendChild(el("span", `bdot${working ? " on" : ""}`));
    // no context fill and no model here: the sidebar row carries both for every session at once
    // (owner 2026-09-19). What the head adds is the one thing the row cannot: how long it is quiet.
    const word = working ? "Working" : s.lastOutput > 0 ? `Quiet for ${agoEn(Date.now() - s.lastOutput)}` : "Quiet";
    const kind = brief?.worktree ? "Lane" : noGit ? "Folder session" : brief ? "Repo session" : "Session";
    meta.appendChild(document.createTextNode(`${word} · ${kind} in Slot ${slot}`));
    const ref = s.worktree ? bands.get(s.id) : undefined;
    if (ref) {
      meta.appendChild(document.createTextNode(" · "));
      const r = el("span", "ref", ref);
      r.style.setProperty("--proj-h", String(projectHue(s.worktree?.repo ?? s.repo ?? s.cwd ?? "")));
      r.title = "The same address as in the sidebar and at its branch in the git structure";
      meta.appendChild(r);
    }
    const since = facts?.sessionStart ?? s.openedAt ?? null;
    if (since) meta.title = `Session since ${new Date(since).toLocaleString("en-GB")}`;
    idsec.appendChild(meta);
  }
  // THE STATES THAT ONLY EXIST WHEN THEY ARE TRUE — none of them costs a line on a healthy session
  if (s.agent === "no-agent") {
    const a = el("div", "bwait owner", "No agent in this pane");
    a.title = "The pane is alive and takes keys, but nothing runs in it — typing reaches no agent.";
    idsec.appendChild(a);
  }
  if (s.stalled) {
    const st = el("div", "bwait main", s.stalledSince ? `Stalled for ${gateAge(Date.now() - s.stalledSince)}` : "Stalled");
    st.title = "No output, nothing waits for an answer — the lane stands still.";
    idsec.appendChild(st);
  }
  if (s.autoCloseRefusal) {
    const r = el("div", "brefusal", s.autoCloseRefusal);
    r.title = "Why closing by itself leaves this lane open";
    idsec.appendChild(r);
  }
  if (s.awaiting) {
    const w = el("div", `bwait ${s.awaiting}`, s.awaiting === "owner" ? "Waiting for you" : "Waiting for its MAIN");
    w.title = s.awaiting === "owner"
      ? "This session holds until you answer — its last message or an open question says what it needs."
      : "This session holds until the MAIN that leads it answers.";
    idsec.appendChild(w);
  }
  if (s.mission) {
    const mi = el("div", "bmission", s.mission);
    mi.title = s.mission;
    idsec.appendChild(mi);
  }
  // THE VALUES, apart from the name by one group gap (§3b: "freistehender")
  const kv = el("div", "bkvs");
  // THE SESSION STAYS SIMPLE (owner 2026-10-08: „[Zitat entfernt]“
  // ; "die Session-Ansicht selbst ... einfach
  // nur die Übergabe"): branch, target and checks are the lane's row under Arbeitsorte now — the
  // copies stay behind ⋯, the land's progress in the Changes block
  kv.appendChild(contextRow(c));
  kv.appendChild(deliveryRow(s, slot));
  const links = belongsLinks(c);
  if (links.length) kv.appendChild(kvRow("Belongs to", links, "lks"));
  idsec.appendChild(kv);
  // a lane's next step is „Land lane“: its handover block stands under Changes instead (Bauleitung 16.10. for K16 uebergabe-b)
  const ub = handoverUnderChanges(c) ? null : handoverBlock(c);
  if (ub) idsec.appendChild(ub);
  return idsec;
}

// the ⋯ of the session: the copies (Branch and Commit live here since they left the chips) and
// bringing the session back, last because it is the one with a loss
function kopfItems(c: BoardCtx): HTMLElement[] {
  const { s, slot, brief } = c;
  const items: HTMLElement[] = [];
  const copyItem = (label: string, value: string, note: string) => {
    const b = popItem(label, `${value} — copy`, (b) => { copyText(value); const t = b.querySelector(".t"); if (t) t.textContent = "Copied"; }, note);
    // a copied value is code and stands in the code face; a menu's other notes are words
    b.querySelector(".kk")?.classList.add("mono");
    return b;
  };
  if (brief?.branch) items.push(copyItem("Copy branch", brief.branch, `…${brief.branch.slice(-14)}`));
  if (brief?.head) items.push(copyItem("Copy commit", brief.head, brief.head.slice(0, 7)));
  if (brief?.worktree && s.cwd) items.push(copyItem("Copy worktree path", s.cwd, ""));
  if (items.length) items.push(el("div", "sep"));
  // bring session back — the repair for a pane that switched conversations on you. Claude Code
  // can change session IN-PROCESS: the pane keeps the argv it was spawned with, so nothing on
  // the outside can tell, and Escape does not undo it. A respawn does, because the slot still
  // holds the pinned sessionId and the server restarts the pane with --resume. There is no
  // deterministic signal for "this pane wandered off", so the owner decides, not a detector.
  items.push(popItem("Bring the session back", "Restart the pane and resume the pinned conversation — the slot keeps its lane, "
    + "name, model, permissions and scheduled prompts. What the session is doing RIGHT NOW is lost.", async (b) => {
    if (!(await askRisk({
      title: `Restart the pane of slot ${slot} and resume the pinned conversation?`,
      body: [el("div", "bmidrun",
        "Nothing of the slot is thrown away. But the agent is ended — what it is doing right now, "
        + "a running tool call or output not yet sent, is lost.")],
      buttons: [
        { label: "Cancel", value: false },
        { label: "Restart", danger: true, value: true },
      ],
    }))) return;
    const t = b.querySelector(".t");
    b.disabled = true;
    if (t) t.textContent = "Restarting…";
    const r = await post(`/api/slots/${slot}/restart`, {});
    const j = await r.json().catch(() => null) as { resumed?: boolean; error?: string } | null;
    if (!r.ok) { alert(j?.error ?? "Restart failed"); b.disabled = false; if (t) t.textContent = "Bring the session back"; return; }
    // "fresh" means the pinned conversation could NOT be resumed (no pin, or its transcript is
    // gone) — the one outcome the owner must not mistake for success
    if (t) t.textContent = j?.resumed ? "The session is back" : "Started fresh — the conversation could not be resumed";
    await refresh();
  }, "", true));
  return items;
}

// the land check of this slot on the meter, while a land runs (the Changes block's progress note)
const landBall = (slot: number): MeterBall | null => meterModel().balls.find((b) => b.slot === slot && b.kind === "land check") ?? null;
// KONTEXT — one line instead of four (§4): the fill, and the switch that opens the handover settings
// with the threshold on its face. That Fleet nudged the session shows only when it did (§3a); the plan stands on hover.
const tok = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n);
function successionOf(c: BoardCtx): BriefSuccession | null {
  const fresh = freshSuccession(c.slot, c.s.openedAt);
  if (fresh) return fresh;
  const raw = c.facts?.succession;
  if (!raw) return null;
  return { ...raw, pctFrom: raw.pctFrom ?? "fleet", nudgeOn: raw.nudgeOn ?? true, defaultPct: raw.defaultPct ?? raw.thresholdPct ?? 0 };
}
function contextRow(c: BoardCtx): HTMLElement {
  const sc = successionOf(c);
  if (!sc) return kvRow("Context", [el("span", "s1", "not reported")]);
  const fill = sc.fill ? `${Math.round(sc.fill.pct)} %` : "not measurable";
  const sw = el("button", "optsw") as HTMLButtonElement;
  sw.type = "button";
  // where Fleet nudges, and the cap the session has while the cache is warm (Mangel 76; owner 17:5x: „[Zitat entfernt]“);
  // „[Zitat entfernt]“ where none comes (76b)
  const at = handoverAt(sc);
  sw.append(document.createTextNode(at ? `Succession at ${at.pct}${at.cap !== null ? `–${at.cap}` : ""} %` : "Succession off"), icon("chevron"));
  sw.title = at === null ? `No succession by Fleet: ${OFF_WHY[sc.thresholdOff ?? "session"]}`
    : `Fleet nudges the session once to succeed at ${at.pct} %${sc.pctFrom === "session" ? ` (this session's own value; Fleet: ${sc.defaultPct} %)` : ""}`
      + (at.cache === "kalt" ? `; the cache is cold, so Fleet types nothing${at.cap !== null ? ` and acts itself only at ${at.cap} %` : ""}`
        : at.cap !== null ? `; it has until ${at.cap} % while the cache is warm` : "");
  // the switch opens and closes the controls in the „Succession“ block below
  const open = handoverOpenOn(c);
  sw.dataset.uk = "ueb";
  sw.classList.toggle("on", open);
  sw.setAttribute("aria-expanded", String(open));
  sw.setAttribute("aria-controls", `bueb-${c.slot}`);
  sw.onclick = () => toggleHandover(c, open);
  // that and when Fleet nudged stands on the block's first line right below, not twice
  const v: (Node | string)[] = [el("span", "fill", fill), " · ", sw];
  const r = kvRow("Context", v, "ctx");
  const fillEl = r.querySelector<HTMLElement>(".fill");
  if (fillEl) fillEl.title = sc.fill
    ? `${sc.fill.usedTokens} of ${sc.fill.windowTokens} tokens in the window (${tok(sc.fill.usedTokens)} / ${tok(sc.fill.windowTokens)}) — the succession is measured against this.`
    : "Fleet can't measure this context: no pinned conversation, no usage record yet, or no known window — it is not an empty context.";
  return r;
}
// HOW THE POSTFACH ARRIVES (Auftrag „Die Zustellung von Postfach-Nachrichten wird Teil des Setups“):
// one line in the session's values, the value itself is the switch. The server holds the choice
// (POST /api/slots/:id/zustellung); absent, the row shows the role's default — a lane bundles, every
// other session comes direct — and says so on hover.
function deliveryRow(s: SlotInfo, slot: number): HTMLElement {
  const chosen = s.zustellung;
  const value = chosen ?? (s.worktree ? "gebuendelt" : "direkt");
  const bundling = value === "gebuendelt";
  const source = chosen ? "set on this session" : s.worktree ? "the default for a lane" : "the default for this session";
  const next = bundling ? "direkt" : "gebuendelt";
  const b = el("button", "optsw") as HTMLButtonElement;
  b.type = "button";
  b.dataset.uk = "zustellung";
  b.append(document.createTextNode(bundling ? "Bundled" : "Direct"), icon("chevron"));
  b.title = `${bundling ? "Postfach messages wait in the bundle and arrive there with their full text"
    : "Postfach messages arrive after about a minute with their full text"} — ${source}. Click for ${next === "gebuendelt" ? "bundled" : "direct"}.`;
  b.setAttribute("aria-label", `Delivery: ${bundling ? "bundled" : "direct"} (${source}). Switch to ${next === "gebuendelt" ? "bundled" : "direct"}.`);
  b.onclick = async () => {
    b.disabled = true;
    const r = await post(`/api/slots/${slot}/zustellung`, { zustellung: next });
    const j = (await r.json().catch(() => null)) as { error?: string } | null;
    if (!r.ok) { alert(j?.error ?? "The delivery could not be changed."); b.disabled = false; return; }
    await refresh();
    void renderBoard();
  };
  return kvRow("Delivery", [b], "zustellung");
}
// THE „ÜBERGABE“ BLOCK (K16 Runde 3, owner 16.10. 09:1x: „[Zitat entfernt]“
// ): the flow from now on (src/handover-now.ts#flowSteps), and while the Kontext switch
// or „Einstellen“ holds it open, each step with its own control (src/handover.ts#handoverFlow). ⓘ shows every step's
// explanation — the phone has no hover.
let handoverOpen: { slot: number; openedAt: number | undefined } | null = null;
// a lane with its Changes drawn: the block follows Land lane, so Land lane stays on the first screen
const handoverUnderChanges = (c: BoardCtx): boolean => !!c.s.worktree && !!c.brief;
let handoverExplain = false;
const handoverOpenOn = (c: BoardCtx): boolean => handoverOpen?.slot === c.slot && handoverOpen.openedAt === c.s.openedAt;
const toggleHandover = (c: BoardCtx, open: boolean): void => {
  handoverOpen = open ? null : { slot: c.slot, openedAt: c.s.openedAt };
  if (!paintHandover(c)) void renderBoard();
};
function handoverBlock(c: BoardCtx): HTMLElement | null {
  const sc = successionOf(c);
  if (!sc) return null;
  const open = handoverOpenOn(c);
  const b = el("div", `bueb${open ? " open" : ""}${handoverExplain ? " explain" : ""}`);
  b.id = `bueb-${c.slot}`;
  if (open) {
    b.setAttribute("role", "group");
    b.setAttribute("aria-label", "Succession settings");
  }
  const head = el("div", "buebh");
  const info = el("button", `buebi${handoverExplain ? " on" : ""}`, "ⓘ") as HTMLButtonElement;
  info.type = "button";
  info.dataset.uk = "ueb-i";
  info.title = handoverExplain ? "Hide the explanations" : "Explain each line";
  info.setAttribute("aria-pressed", String(handoverExplain));
  info.onclick = () => { handoverExplain = !handoverExplain; if (!paintHandover(c)) void renderBoard(); };
  const edit = el("button", `buebedit${open ? " on" : ""}`, open ? "Done" : "Change") as HTMLButtonElement;
  edit.type = "button";
  edit.dataset.uk = "ueb-edit";
  edit.setAttribute("aria-expanded", String(open));
  edit.setAttribute("aria-controls", `bueb-${c.slot}`);
  edit.onclick = () => toggleHandover(c, open);
  head.append(el("span", "t", "Succession"), info, edit);
  b.appendChild(head);
  const flow = el("div", "buebflow");
  flow.append(...handoverFlow({ slot: c.slot, openedAt: c.s.openedAt, sc, open, lane: sc.kind === "lane" || sc.rail === "lane", handoverAt: c.s.standingHandover?.at,
    repaint: () => paintHandover(c), succeeded: () => { handoverOpen = null; void renderBoard(); } }));
  b.appendChild(flow);
  return b;
}
// THE KONTEXT LINE AND THE „ÜBERGABE“ BLOCK REDRAWN WHERE THEY STAND (K9 S1, owner 13.10.: „[Zitat entfernt]“): opening the
// settings and every write in them rebuild these two from what the client holds — no /brief, no column render per
// click. The board's next tick rebuilds them with the rest. False = they are not on screen.
function paintHandover(c: BoardCtx): boolean {
  const oldRow = boardBody.querySelector<HTMLElement>(".bkv.ctx");
  const oldBlock = boardBody.querySelector<HTMLElement>(".bueb");
  if (!oldRow || !oldBlock || panes[focused]?.slot !== c.slot) return false;
  const a = document.activeElement;
  const key = a instanceof HTMLElement && (oldRow.contains(a) || oldBlock.contains(a)) ? a.dataset.uk ?? null : null;
  const wasOpen = oldBlock.classList.contains("open");
  const row = contextRow(c);
  oldRow.replaceWith(row);
  const block = handoverBlock(c);
  if (block) oldBlock.replaceWith(block);
  else oldBlock.remove();
  const root = row.closest(".bhead") ?? boardBody;
  if (key) root.querySelector<HTMLElement>(`[data-uk="${key}"]`)?.focus({ preventScroll: true });
  if (!wasOpen && block?.classList.contains("open") && !isMobile()) block.scrollIntoView({ block: "nearest" });
  return true;
}
// GEHÖRT ZU — the order, the Program and the lane's file as links (they were chips with a frame)
function belongsLinks(c: BoardCtx): HTMLElement[] {
  const { s, brief } = c;
  const out: HTMLElement[] = [];
  const link = (label: string, title: string, run: () => void) => {
    const b = el("button", "lk", label) as HTMLButtonElement;
    b.type = "button";
    b.title = title;
    b.onclick = run;
    out.push(b);
  };
  if (s.taskId) link(`Task ${s.taskId.slice(0, 8)}`, `${s.taskHead || "the task this session was started from"} — opens the task view`, () => openQueue());
  if (s.programId) {
    const p = programsPoll.find((x) => x.id === s.programId);
    link(`Program ${p?.title ? p.title.slice(0, 28) : s.programId.slice(0, 8)}`, `${p?.title ?? s.programId} — opens the task view`, () => openQueue());
  }
  if (brief?.worktree) {
    const branch = brief.worktree.branch;
    link("Record", "This lane from start to end — its task, its prompts, its commits, its land", () => void openAkte(branch));
  }
  return out;
}

// --- 3 CHANGES: the uncommitted tree, Commit, Land lane as THE action, Rebase only when behind, and
// Shelve · Park for review behind the ⋯ beside it (G4.2)
function changesSection(c: BoardCtx, brief: BriefInfo): HTMLElement {
  const { s, slot, mg, ahead, behind } = c;
  const work = el("div", "bsec bchanges");
  work.appendChild(sectionHead(SECTION.changes, "session"));
  // an interrupted rebase/merge (e.g. a deploy that killed the server mid-land) wedges commit + land
  // here — surface it as an explicit, fixable state, not a silent refusal
  if (brief.gitOp) {
    work.appendChild(el("div", "bgitop",
      "⚠ a git merge/rebase is in progress — finish or abort it in this session's terminal (git rebase --abort / git merge --abort), then retry. Commit & land are blocked until then."));
  }
  const running = !!mg?.running;
  const crow = el("div", "bbtnrow bchangeacts");
  if (brief.uncommitted) {
    const wl = el("div", "bstate");
    wl.appendChild(el("span", "editing", `${brief.uncommitted} uncommitted file${brief.uncommitted === 1 ? "" : "s"}`));
    if (ahead) wl.appendChild(document.createTextNode(` · ${ahead} commit${ahead === 1 ? "" : "s"} ready`));
    work.appendChild(wl);
    // the concrete uncommitted work — exactly what git status shows, with its codes, every file
    // (the server caps the status read at 200 lines and says so below when it hit that cap)
    if (brief.uncommittedFiles.length) {
      const uf = el("div", "bunc");
      for (const f of brief.uncommittedFiles) {
        // porcelain XY: X = staged (index) column, Y = worktree (unstaged) column
        const x = f[0] ?? " ", y = f[1] ?? " ";
        const row = el("button", "buncf");
        const cls = f.startsWith("??") ? "new" : x !== " " ? "staged" : "mod";
        const badge = el("span", `buncst ${cls}`, f.startsWith("??") ? "?" : f.slice(0, 2).trim() || "M");
        // untracked FIRST: porcelain sets both columns to '?', so every x/y test below matches it
        badge.title = f.startsWith("??") ? "untracked"
          : x !== " " && y !== " " ? "staged + unstaged changes"
          : x !== " " ? "staged" : "unstaged changes";
        row.appendChild(badge);
        row.appendChild(el("span", "p", f.slice(3)));
        // a row opens the review window ON its file; an UNTRACKED file has no diff, so the file itself
        const upath = porcelainPath(f);
        const untracked = f.startsWith("??");
        row.title = untracked ? `${f} — click to read it (untracked: there is no diff yet)`
          : `${f} — click to see what changed in this file`;
        row.onclick = () => void openReview(slot, "working",
          untracked ? { k: "untracked", path: upath } : { k: "file", path: upath });
        uf.appendChild(row);
      }
      // "everything you changed" and "the first 200" are different claims
      if (brief.uncommitted > brief.uncommittedFiles.length)
        uf.appendChild(el("div", "bempty",
          `… ${brief.uncommitted - brief.uncommittedFiles.length} more — the server reads at most 200 status lines`));
      work.appendChild(uf);
    }
    const busy = commitBusy.get(slot);
    if (brief.worktree) {
      // ONE commit here — the safety net: an instant wip commit so a kill can't lose the work (saved
      // locally, never pushed or landed, reversible with git reset); land commits-if-dirty itself
      const q = el("button", "bbtn", busy === "quick" ? "Committing…" : "Commit") as HTMLButtonElement;
      q.disabled = !!busy; // also disabled mid-land, while doLand's commit-if-dirty runs (busy === "agent")
      q.title = "commit all uncommitted work now so a kill can't lose it — saved locally, never pushed or landed (undo with git reset)";
      q.onclick = () => void doCommit(slot, "quick");
      crow.append(q);
    } else {
      // main (non-lane) session: commit TRACKED changes (add -u) with a staging preview, so the owner
      // sees exactly what lands on a branch they ship and that untracked files are left alone
      const files = brief.uncommittedFiles;
      const q = el("button", "bbtn", busy === "quick" ? "Committing…" : "Commit") as HTMLButtonElement;
      q.disabled = !!busy;
      q.title = "stage & commit tracked changes only (git add -u); untracked files left alone — undo with git reset. Shows a preview first.";
      q.onclick = () => void doCommitMain(slot, "quick", files);
      const a = el("button", "bbtn quiet", busy === "agent" ? "Writing message…" : "Commit with written message") as HTMLButtonElement;
      a.disabled = !!busy;
      a.title = "same commit, but a short-lived agent writes a conventional-commit message from the staged diff first";
      a.onclick = () => void doCommitMain(slot, "agent", files);
      crow.append(q, a);
    }
  } else if (running && brief.worktree) {
    work.appendChild(el("div", "bstate", `Nothing uncommitted · ${ahead} commit${ahead === 1 ? "" : "s"} landing`));
  } else if (ahead) {
    work.appendChild(el("div", "bstate", `Nothing uncommitted · ${ahead} commit${ahead === 1 ? "" : "s"} ready${brief.worktree ? "" : " to push"}`));
  } else {
    // nothing to show, so no "View diff" under it
    work.appendChild(el("div", "hint bnote", "Nothing uncommitted, nothing ahead."));
  }
  // WHAT THIS LANE CHANGES stands here, under its state (owner 2026-10-09: „[Zitat entfernt]“
  // ) — the committed
  // footprint vs the base, the uncommitted files above it; History keeps the commits
  if (brief.files.length) work.appendChild(footprintBlock(slot, brief));
  // BEHIND — and, on a lane, the one action that fixes it. The button carries the number, so there is
  // never a count without a way to act on it and never an action without its reason (owner 2026-09-20)
  const baseName_ = brief.laneBase ?? "main";
  let rebaseBtn: HTMLButtonElement | null = null;
  if (behind && brief.laneScoped) {
    if (brief.worktree) {
      rebaseBtn = el("button", "bbtn quiet", rebaseBusy.has(slot) ? "Rebasing…" : `Rebase — ${behind} behind ${baseName_}`) as HTMLButtonElement;
      rebaseBtn.disabled = rebaseBusy.has(slot);
      rebaseBtn.title = `replay this lane's commits on top of ${baseName_}. It ONLY rebases: it does not verify `
        + "and it does not land, and on a conflict it aborts and leaves the lane exactly as it is.";
      rebaseBtn.onclick = () => void doRebase(slot);
    } else {
      work.appendChild(el("div", "hint bnote", `${behind} commit${behind === 1 ? "" : "s"} behind ${baseName_}`));
    }
  }
  // …and what the last rebase did, which outlives the count it removed
  const rbNote = ((): HTMLElement | null => {
    const note = rebaseNote.get(slot);
    if (!note) return null;
    if (Date.now() - note.at > REBASE_NOTE_MS) { rebaseNote.delete(slot); return null; }
    const n = el("div", note.ok ? "hint bnote ready" : "bstate rbfail", note.text);
    if (note.files?.length) {
      const list = el("div", "bunc");
      for (const f of note.files) list.appendChild(el("div", "bfile", f));
      n.appendChild(list);
    }
    return n;
  })();
  if (!brief.worktree) {
    if (crow.childElementCount) work.appendChild(crow);
    if (rbNote) work.appendChild(rbNote);
    return work;
  }
  // THE LANE'S ENDGAME: one land verb on screen at a time. Normally it IS the land; in the review
  // state the note owns "Land", so this becomes "Re-run merge" — never a second competing land
  // button. On a follower fleet (FLEET_LANDS=0) the verb is ABSENT, not greyed: the server's 409 is
  // the guarantee, this is the board declining to offer a gesture it knows is refused.
  const l = !running && mg?.last && mg.last.branch === brief.worktree.branch ? mg.last : null;
  // an INTERRUPTED run that had already handed the conflicts to the agent needs the same eye as a
  // settled "resolved" verdict (server.ts, needsMergeReview)
  const awaitingReview = l?.status === "resolved" || (l?.status === "interrupted" && (l.conflicted?.length ?? 0) > 0);
  if (landsEnabled) {
    const lb = el("button", "bbtn" + (ahead && !running && !awaitingReview ? " primary" : ""),
      running ? "Landing…" : awaitingReview ? "Re-run merge" : "Land lane") as HTMLButtonElement;
    lb.disabled = running;
    lb.title = awaitingReview
      ? "re-run the merge from scratch — only needed if main moved since these conflicts were resolved"
      : `Land the lane on ${baseName_} — it is checked first. A lane already merged lands at once; on conflicts an agent resolves them in the background and waits for your review before anything reaches ${baseName_}.`;
    lb.onclick = () => void doLand(slot);
    crow.appendChild(lb);
  }
  // ⋯ — the rarer exits of a lane: set aside with a note, park for a later review. Shelve stays
  // reachable on a follower fleet too.
  const more = el("button", "bib bland") as HTMLButtonElement;
  more.appendChild(icon("dots"));
  more.title = "More lane actions — shelve, park for review";
  more.setAttribute("aria-label", "More lane actions");
  more.disabled = running;
  crow.appendChild(popTrigger("land", slot, more));
  if (rebaseBtn) crow.appendChild(rebaseBtn);
  if (!landsEnabled) crow.appendChild(el("div", "bmergedetail",
    "this fleet follows a canonical main and does not land — land this branch on the canonical host"));
  if (!running && boardPop?.kind === "land" && boardPop.slot === slot) {
    const items: HTMLElement[] = [
      popItem("Shelve", "set this lane aside with a note (what's left) — kills the slot, keeps the worktree to resume later; nothing lost, nothing destroyed",
        () => { boardPop = null; void doShelve(slot); }, "with a note"),
      popItem("Park for review", "park this finished lane for a later review — frees the slot, keeps worktree, task ids, head, base and the accepted report; the tasks do not start again, reopening binds them back (verify then counts as stale)",
        () => { boardPop = null; void doShelve(slot, true); }, "frees the slot"),
    ];
    crow.append(...popPanel("land", items));
  }
  work.appendChild(crow);
  if (running) {
    // while it lands: how far, against the usual duration of this kind of check where one exists
    const ball = landBall(slot);
    const note = el("div", "landnote");
    note.appendChild(el("span", "dot live"));
    const since = ball && ball.at > 0 ? mmss(serverClock() - ball.at) : null;
    note.appendChild(document.createTextNode(!ball ? "Landing — the check has not started yet"
      : ball.station === "wait" ? `waiting for the check${since ? ` · ${since}` : ""}`
      : `being checked${since ? ` · ${since}` : ""}${ball.expect ? ` of usually ${mmss(ball.expect.p50)}` : ""}`));
    work.appendChild(note);
  }
  if (awaitingReview && l) {
    // the agent resolved conflicts and the server verified the rebase — the owner reviews the diff
    // and lands. This is the one place a human eye is required.
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
    const rev = el("button", "bmergereview", "Review diff") as HTMLButtonElement;
    rev.onclick = () => void openMergeDiff(slot);
    acts.append(rev);
    // reviewing a carried-over verdict stays available on a follower; confirming it does not
    if (landsEnabled) {
      const landb = el("button", "bmergeland", "Land") as HTMLButtonElement;
      landb.onclick = () => void doMergeLand(slot);
      acts.append(landb);
    }
    note.appendChild(acts);
    work.appendChild(note);
  } else if (l && failedLandVerdict(l)) {
    const note = el("details", `bmergenote ${l.status === "blocked" ? "warn" : "err"} landalarm`);
    const alarmKey = `${l.branch}:${l.at}`;
    (note as HTMLDetailsElement).open = landAlarmOpens.has(alarmKey);
    note.addEventListener("toggle", () => {
      if ((note as HTMLDetailsElement).open) landAlarmOpens.add(alarmKey);
      else landAlarmOpens.delete(alarmKey);
    });
    const kind = l.status === "blocked" ? "Land blockiert" : l.status === "interrupted" ? "Land unterbrochen" : "Land fehlgeschlagen";
    note.appendChild(el("summary", "", `${kind} · ${laneNameOfBranch(l.branch)}`));
    note.appendChild(el("div", "bmergedetail", l.detail));
    note.appendChild(verifyBadge(l.verify));
    work.appendChild(note);
  } else if (l) {
    // "awaiting-author" is a WAIT, not a failure: the lane's own session is resolving its own conflict
    const cls = (l.status === "merged" && l.landed) || l.status === "awaiting-author" ? "ok"
      : l.status === "blocked" ? "warn" : "err";
    const vn = el("div", `bmergenote ${cls}`,
      `${l.status === "merged" ? (l.landed ? "merged + landed" : "merged, NOT landed")
        : l.status === "awaiting-author" ? "the lane's own session is resolving this conflict" : l.status}: ${l.detail} `);
    vn.appendChild(verifyBadge(l.verify));
    work.appendChild(vn);
  }
  if (rbNote) work.appendChild(rbNote);
  return work;
}

// THE COMMITTED FOOTPRINT under Changes: what this lane/session changes vs its base — the first few
// files, every one behind one button (the brief carries 200 and says so past that)
const FILES_SHOWN = 5;
function footprintBlock(slot: number, brief: BriefInfo): HTMLElement {
  const box = el("div", "bfoot");
  const fh = el("div", "bsubhead", brief.laneScoped ? `Changed vs ${brief.laneBase ?? "main"}` : "Changed files");
  if (brief.shortstat) fh.appendChild(el("span", "bsubstat", brief.shortstat.replace(/ changed|\(|\)/g, "")));
  box.appendChild(fh);
  const all = boardFolds.has("changed");
  for (const f of all ? brief.files : brief.files.slice(0, FILES_SHOWN)) {
    const row = el("button", "bfile");
    row.appendChild(el("span", "bfst", f.slice(0, 2).trim() || "·"));
    row.appendChild(document.createTextNode(f.slice(3)));
    const path = porcelainPath(f);
    row.title = `${f} — click to see what changed in this file`;
    row.onclick = () => void openReview(slot, "working", { k: "file", path });
    box.appendChild(row);
  }
  if (all && brief.filesTotal > brief.files.length)
    box.appendChild(el("div", "bempty", `… ${brief.filesTotal - brief.files.length} more — the brief carries the first 200`));
  const total = brief.filesTotal || brief.files.length;
  if (total > FILES_SHOWN) {
    const b = el("button", "bbtn quiet bmorebtn", all ? "Show less" : `All ${total} files`) as HTMLButtonElement;
    b.type = "button";
    b.setAttribute("aria-expanded", String(all));
    b.title = all ? `Back to the first ${FILES_SHOWN} files` : "Every file this lane changes against its base";
    b.onclick = () => { toggleFold("changed"); void renderBoard(); };
    box.appendChild(b);
  }
  return box;
}

// --- 5 HISTORY: the three newest commits; one button opens the full list as before — every commit
// the brief carries and the base's own history folded (R2); the files they touched stand under Changes
export const HISTORY_SHOWN = 3;
function historySection(c: BoardCtx, brief: BriefInfo): HTMLElement {
  const { s, slot, ahead } = c;
  // Both lists are CLICKABLE, and each opens the lens whose route can serve it: a lane commit the
  // slot's own commit-diff, a REPO commit the Commits lens (measured 2026-08-20: the slot route
  // answers 404 for a commit outside base..HEAD). A <button>, so Enter/Space and focus come with it.
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
  const csec = el("div", "bsec bhist");
  csec.appendChild(sectionHead(SECTION.history, "repo"));
  const base = brief.laneBase ?? "main";
  const all = boardFolds.has("history");
  if (!brief.commits.length) csec.appendChild(el("div", "bempty",
    brief.laneScoped ? `No commits on this lane yet.` : "No commits this session yet."));
  for (const cm of all ? brief.commits : brief.commits.slice(0, HISTORY_SHOWN)) csec.appendChild(commitRow(cm, "session"));
  const total = brief.laneScoped ? Math.max(ahead, brief.commits.length) : brief.commits.length;
  // the repo's last commits include the session's own (server.ts#repoRecentCommits): only what stands above once
  const shown = new Set(brief.commits.map((cm) => cm.hash));
  const earlier = brief.repoCommits.filter((cm) => !shown.has(cm.hash));
  const more = total > HISTORY_SHOWN || earlier.length > 0;
  if (all) {
    // a list that stops at its cap must say so — for a lane the true total is `ahead`, and a
    // time-scoped session has no total, so there the cap itself is the honest sentence
    if (brief.laneScoped && ahead > brief.commits.length)
      csec.appendChild(el("div", "bempty",
        `… ${ahead - brief.commits.length} older commit${ahead - brief.commits.length === 1 ? "" : "s"} — the brief carries the newest ${brief.commitsCap}`));
    else if (!brief.laneScoped && brief.commits.length >= brief.commitsCap)
      csec.appendChild(el("div", "bempty", `the newest ${brief.commitsCap} — this session may have made more`));
    if (earlier.length)
      csec.appendChild(boardFold("repoCommits", brief.laneScoped ? `Already in ${base}` : "Earlier in this repo",
        String(earlier.length), (box) => { for (const cm of earlier) box.appendChild(commitRow(cm, "repo")); }));
  }
  if (more || all) {
    // "All N commits" only where some are hidden — three or fewer all stand above already
    const label = all ? "Show less"
      : [total > HISTORY_SHOWN ? `All ${total} commits` : "",
        earlier.length ? (brief.laneScoped ? `Already in ${base}` : "Earlier in this repo") : ""].filter(Boolean).join(" · ");
    const b = el("button", "bbtn quiet bmorebtn", label) as HTMLButtonElement;
    b.type = "button";
    b.setAttribute("aria-expanded", String(all));
    b.title = all ? "Back to the three newest commits" : "The whole history: every commit and what is already in the base";
    b.onclick = () => { toggleFold("history"); void renderBoard(); };
    csec.appendChild(b);
  }
  return csec;
}
function toggleFold(key: string): void {
  if (boardFolds.has(key)) boardFolds.delete(key); else boardFolds.add(key);
  prefSet("fleet.board.folds", JSON.stringify([...boardFolds]));
}

// --- 6 MORE ABOUT THIS SESSION: four tabs, closed, each a line with its summary (G3.2); open shows the
// former block unchanged. Which is open is a device preference (fleet.board.folds, src/prefs.ts).
function boardTab(key: string, title: string, sum: string, fill: (body: HTMLElement) => void, extra?: HTMLElement): HTMLElement {
  const open = boardFolds.has(key);
  const box = el("div", `btab${open ? " open" : ""}`);
  box.dataset.tab = key;
  const hd = el("div", "btabhd");
  const b = el("button", "btabbtn") as HTMLButtonElement;
  b.type = "button";
  b.setAttribute("aria-expanded", String(open));
  const chev = icon("chevron");
  chev.classList.add("chev");
  b.append(chev, el("span", "tt", title), el("span", "sum", sum));
  b.title = `${title} — ${open ? "collapse" : "expand"}`;
  b.onclick = () => { toggleFold(key); void renderBoard(); };
  hd.appendChild(b);
  if (extra) hd.appendChild(extra);
  box.appendChild(hd);
  // a closed tab builds nothing: its body is only filled (and its data only fetched) when open
  if (open) {
    const body = el("div", "btabbody");
    fill(body);
    box.appendChild(body);
  }
  return box;
}
function rightsSummary(s: SlotInfo): string {
  const program = s.programId ? programsPoll.find((x) => x.id === s.programId) : undefined;
  const own = s.worktree ? (s.taskId ? "its own task" : "no task")
    : s.programId ? `Program ${program?.title ? program.title.slice(0, 20) : s.programId.slice(0, 8)}` : "no work of its own";
  return own;
}
function moreSection(c: BoardCtx): HTMLElement {
  const { s, slot, brief, facts, prompts, outlineErr } = c;
  const sec = el("div", "bsec bmoresec");
  sec.appendChild(sectionHead(SECTION.more, "session"));
  const setup = facts?.setup;
  const packs = setup?.packs ?? [];
  const setupSum = [setup?.profile ?? "standard", packs.length ? `${packs.length} ${packs.length === 1 ? "Pack" : "Packs"}` : "",
    s.browser ? "Browser" : "", s.container ? "Container" : ""].filter(Boolean).join(" · ");
  sec.appendChild(boardTab("setup", SECTION.setup, setupSum, (body) => setupBody(c, body)));
  sec.appendChild(boardTab("rechte", SECTION.rights, rightsSummary(s), (body) => {
    // the rights block unchanged (src/rights.ts#rightsSection) — its own head is this tab's
    const r = rightsSection(s);
    r.querySelector(":scope > h3")?.remove();
    body.appendChild(r);
  }));
  // POSTFACH (K13, src/postfach.ts): only where this session has written or received a message
  const openedAt = s.openedAt;
  if (openedAt) {
    loadPostfach(() => void renderBoard());
    const mail = postfachOf(slot, openedAt);
    if (mail?.length) sec.appendChild(boardTab("postfach", SECTION.messages, postfachSummary(mail, slot, openedAt),
      (body) => postfachBody(body, mail, slot, openedAt)));
  }
  // FILES: drawn where there is a branch (the tree is `git ls-files`). The explorer opens from the
  // tab's glyph without opening the tab; the tree loads once per working directory (the latch).
  if (brief?.branch) {
    fxGit.set(s.cwd!, { lines: brief.uncommittedFiles, total: brief.uncommitted, branch: brief.branch });
    const cwd = s.cwd!;
    const known = fxTree.get(cwd);
    if (!known && !fxAsked.has(cwd)) { fxAsked.add(cwd); void loadTree(slot, cwd); }
    const ex = glyphBtn("folder", "Open explorer", "Open the explorer — without expanding", () => openExplorer(slot, cwd));
    ex.classList.add("btabx");
    const sum = !known ? "reading…" : "error" in known ? "not readable" : `${known.total} ${known.total === 1 ? "file" : "files"}`;
    sec.appendChild(boardTab("files", SECTION.files, sum, (body) => {
      const fx = fileTreeSection(slot, cwd);
      body.append(...fx.childNodes);
    }, ex));
  }
  sec.appendChild(boardTab("prompts", SECTION.prompts, outlineErr ? "not readable" : String(prompts.length), (psec) => {
    if (outlineErr) psec.appendChild(el("div", "bstate", `The transcript could not be read — ${outlineErr}.`));
    else if (!prompts.length) psec.appendChild(el("div", "bempty", "None in the transcript yet."));
    prompts.forEach((p, i) => {
      const row = el("button", "bprompt");
      row.appendChild(el("span", "bn", String(i + 1)));
      const t = el("span", "bt", p);
      t.title = p;
      row.appendChild(t);
      row.onclick = () => panes[focused]?.showPromptAt(i);
      psec.appendChild(row);
    });
  }));
  return sec;
}
// SETUP, unchanged inside its tab: what this session is MADE of (owner 2026-09-19: „[Zitat entfernt]“
// )
// DIE FASSUNG, MIT DER DIESER SITZ LÄUFT: der festgehaltene Start (GET /api/slots/:id/fassung?anlass=laufend), je Belegung gelesen und
// nach FASSUNG_FRISCH_MS neu, denn Schwelle und Warmhalten kann der Owner nach dem Start ändern (die Route führt sie nach). Das Fenster zeigt
// vor dem Start dieselben acht Zeichen; null = die Antwort kam nicht, dann steht keine Zeile. Darunter, was den Sitz außer Fleets Zeile formt
// (src/fassung-umfeld-zeilen.ts).
interface FassungGelesen { hash: string; zeilen: UmfeldZeile[]; nachgefuehrt: string[]; at: number }
const FASSUNG_FRISCH_MS = 15_000;
const fassungLaeuft = new Map<string, FassungGelesen | null>(), fassungImFlug = new Set<string>();
function fassungLesen(slot: number, openedAt: number, wohin: HTMLElement | null): void {
  const key = `${slot}:${openedAt}`;
  if (fassungImFlug.has(key)) return;
  fassungImFlug.add(key);
  void api(`/api/slots/${slot}/fassung?anlass=laufend`).then(async (r) => {
    const j: unknown = r.ok ? await r.json().catch(() => null) : null;
    const o = j && typeof j === "object" ? j as { hash?: unknown; teile?: unknown; festgehalten?: { nachgefuehrt?: unknown } | null } : null;
    const h = typeof o?.hash === "string" ? o.hash : null;
    const gelesen = h ? { hash: h, zeilen: Array.isArray(o?.teile) ? umfeldZeilen(o.teile as UmfeldTeil[]) : [],
      nachgefuehrt: Array.isArray(o?.festgehalten?.nachgefuehrt) ? o.festgehalten.nachgefuehrt.map(String) : [], at: Date.now() } : null;
    // eine Neulesung, die scheitert, nimmt die alte Antwort nicht weg
    if (gelesen || !fassungLaeuft.get(key)) fassungLaeuft.set(key, gelesen);
    fassungImFlug.delete(key);
    if (!wohin?.isConnected) return;
    if (gelesen) fassungZeigen(wohin, gelesen); else wohin.closest(".bsrow")?.remove();
  }).catch(() => { if (!fassungLaeuft.get(key)) fassungLaeuft.set(key, null); fassungImFlug.delete(key); wohin?.closest(".bsrow")?.remove(); });
}
const FASSUNG_TITLE = "what this session was started with, as a short hash — the start window shows the same one before the start";
function fassungZeigen(v: HTMLElement, f: FassungGelesen): void {
  v.textContent = fassungKurz(f.hash);
  const r = v.closest(".bsrow") as HTMLElement | null;
  if (r) r.title = f.nachgefuehrt.length ? `${f.hash}\nseit dem Start geändert: ${f.nachgefuehrt.join(", ")}` : f.hash;
  // die Zeilen darunter stehen genau einmal: eine Neulesung ersetzt sie
  let n = r?.nextElementSibling ?? null;
  while (n?.classList.contains("bsumfeld")) { const weg = n; n = n.nextElementSibling; weg.remove(); }
  let nach: Element | null = r;
  for (const z of f.zeilen) {
    const zr = el("div", "bsrow bsumfeld");
    zr.appendChild(el("span", "bskey", z.label));
    const zv = el("span", "bsval", z.wert);
    if (z.eigen) zv.appendChild(el("span", "bseigen", ` · ${EIGEN_WORT}`));
    zr.appendChild(zv);
    zr.title = z.titel;
    nach?.after(zr);
    nach = zr;
  }
}
function setupBody(c: BoardCtx, su: HTMLElement): void {
  const { s, slot, facts } = c;
  su.classList.add("bsetup");
  const row = (label: string, value: string, title?: string) => {
    const r = el("div", "bsrow");
    r.appendChild(el("span", "bskey", label));
    const v = el("span", "bsval", value);
    r.appendChild(v);
    if (title) r.title = title;
    su.appendChild(r);
    return v;
  };
  const setup = facts?.setup;
  // "Program type" since the founding window (F4): "Profile" is the founding choice there, the
  // machine profile of the PROGRAM needed a name that cannot be read as it. Absence IS standard.
  row("Program type", setup?.profile ?? "standard",
    setup?.profile === "game-maker" ? "the owner granted this session's program the game-maker profile"
      : setup?.profile === "standard" ? "this session's program runs on the standard profile"
      : "standard by default — this session has no program bracket to grant another profile");
  if (s.openedAt) {
    const key = `${slot}:${s.openedAt}`, gehalten = fassungLaeuft.get(key);
    if (gehalten !== null) {
      const v = row("Fassung", "…", FASSUNG_TITLE);
      if (gehalten) fassungZeigen(v, gehalten);
      if (!gehalten || Date.now() - gehalten.at > FASSUNG_FRISCH_MS) fassungLesen(slot, s.openedAt, v);
    }
  }
  if (s.browser) row("Browser", "Playwright MCP", "this lane was started with the browser tool attached");
  if (s.container) row("Container", s.containerContext ? `${s.container} · ${s.containerContext}` : s.container,
    "the box and docker context this session's agent runs in");
  // THE PACKS, and where they come from: a receipt is what this pane actually received; the
  // program's declaration is the weaker answer and says so rather than passing for delivery
  const packs = setup?.packs ?? [];
  if (packs.length) {
    const r = el("div", "bsrow bspacks");
    r.appendChild(el("span", "bskey", "Packs"));
    const list = el("span", "bsval");
    // every chip OPENS the pack — its pointers in full, and from there the source file itself
    for (const p of packs) {
      const chip = el("button", "bspack", p.id) as HTMLButtonElement;
      chip.title = [p.useWhen, p.privateSourceId ? "a private pack — its source is outside this repo"
        : `${(p.sources ?? []).length} source${(p.sources ?? []).length === 1 ? "" : "s"} — click to open them`]
        .filter(Boolean).join(" — ");
      if (setup) chip.onclick = () => openPacks(setup, p.id);
      list.appendChild(chip);
    }
    r.appendChild(list);
    su.appendChild(r);
    const from = setup?.packsFrom === "receipt"
      ? `delivered with the founding brief${setup.deliveredAt ? ` ${gateAge(Date.now() - setup.deliveredAt)} ago` : ""}`
        + `${setup.deliveredBytes ? `, ${Math.round(setup.deliveredBytes / 1024)} KB` : ""}`
      : "declared by this session's program — not proof that this pane received them";
    const note = el("div", "bsnote", from);
    if (setup?.omitted.length) note.textContent += ` · ${setup.omitted.length} omitted`;
    if (setup?.omitted.length) note.title = setup.omitted.map((o) => `${o.id}: ${o.why}`).join("\n");
    su.appendChild(note);
    // E34 (docs/design/datenrechte-notiz.md): a pack is a pointer, never a right
    su.appendChild(el("div", "bsnote", "Packs show it where to read up. They grant no right."));
  }
  const since = facts?.sessionStart ?? s.openedAt ?? null;
  const foot: string[] = [];
  if (since) foot.push(`open ${gateAge(Date.now() - since)}`);
  if (s.inbound) foot.push(`${s.inbound.sends} message${s.inbound.sends === 1 ? "" : "s"} received today`);
  const mine = autosList.filter((a) => a.slot === slot && a.enabled).length;
  if (mine) foot.push(`${mine} check-in${mine === 1 ? "" : "s"} armed`);
  if (foot.length) {
    const f = el("div", "bsnote", foot.join(" · "));
    f.title = "how long this occupant has held the slot, what Fleet typed into it today, and its own scheduled prompts";
    su.appendChild(f);
  }
}

// --- ARBEITSORTE: the Ranke at the top of Info (cards e66909b1 and abe74821; docs/design/
// rechter-tab-notiz.md §3b–§3d, Variante 3A, owner-Ja 2026-10-05; docs/design/ranke-notiz.md §0/§0a).
// One table, one row per worktree, fixed columns: lines · address · name · ↑• · the check beads ·
// the test-instance square. Everything comes from ONE read, GET /api/worktrees (src/protocol.ts#
// Workplaces): the repos with their branches and worktrees, and the stand of every carrier (the
// running server, the helper machines, linked instances, test copies, worktrees). A missing value is
// drawn as unknown and never estimated. The read rides the board's existing repaint and is spaced to
// one per WORKPLACES_EVERY_MS — no loop of its own; an owner gesture asks again at once.
//
// Owner additions of 2026-10-05, each one a choice made here:
//  1. the test instance is a SQUARE in its worktree's row (green = it runs; a ring only under the
//     pointer when there is none); a click on it opens the row's instance line with the deadline and
//     Öffnen · Stoppen / Starten;
//  2. the checks are five BEADS at the worktree, in the order they happen: local proofs · preview ·
//     land check · in its target (a diamond, from WorkplaceRow.target) · check after the land;
//  3. the state word left the row: the node says it (green works, brown waits on you, a ring is
//     still), the word is in the tooltip; every graphic has a tooltip and a DOM claim;
//  4. the own lane's block stays the session head below, without a second copy of a row value.
export let workplaces: Workplaces | null = null;
let workplacesErr: string | null = null;
let workplacesAt = 0;
let workplacesBusy = false;
export const WORKPLACES_EVERY_MS = 10_000;
// a forced read asked for while one runs is owed AFTER it: that read may have left before the write
// the caller just made (a test instance's up), and dropping the ask kept its stale answer on screen
let workplacesAgain = false;
onPlacesChanged(() => loadWorkplaces(true));
export function loadWorkplaces(force = false): void {
  loadBranches(force, () => void renderBoard()); // the branches of the board ride the same beat (K5)
  if (workplacesBusy && force) { workplacesAgain = true; return; }
  if (workplacesBusy || (!force && Date.now() - workplacesAt < WORKPLACES_EVERY_MS)) return;
  workplacesBusy = true;
  workplacesAt = Date.now();
  void api("/api/worktrees").then(async (r) => {
    if (!r.ok) {
      workplacesErr = ((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? `HTTP ${r.status}`;
      return;
    }
    workplaces = (await r.json()) as Workplaces;
    workplacesErr = null;
  }).catch(() => { workplacesErr = "the server could not be reached"; })
    .finally(() => {
      workplacesBusy = false;
      if (workplacesAgain) { workplacesAgain = false; loadWorkplaces(true); }
      void renderBoard();
    });
}

// THE COMPOSER'S FOOT (card e66909b1, then the owner's Feinschliff 2026-10-07: „[Zitat entfernt]“
// , „[Zitat entfernt]“): ONE line under the field, at the desk
// at the right end of the tray, on the phone under the field — the session's name, once (neither
// placeholder nor send target repeat it), its branch behind it, and a dot while this page or this
// server runs on older code than the checkout (bundleStale, deployGap). While it runs, the worktree's
// test instance stands as the green square the Ranke draws. No model and no context fill: they are
// the island's and Info's. A click shows that worktree in Info and marks it there. The open island
// on the phone says WHERE in its card instead (#mort): the repo and the branch, the name being on
// the strip above it. Everything here is the poll's row plus the last Arbeitsorte read — no request
// of its own. It lives beside the Arbeitsorte it reads (moved out of src/composer.ts).
let wtFieldKey = "";
export function renderWorkplaceField(): void {
  const slot = panes[focused]?.slot ?? 0;
  const s = slot ? fleet.find((x) => x.id === slot) : undefined;
  // a session without a lane ref in a linked worktree (a branch session, K5) has its worktree as
  // s.repo; the Arbeitsorte know which repo that worktree belongs to
  const holder = s?.cwd && !s.worktree ? workplaces?.repos.find((r) => r.worktrees?.some((w) => !w.primary && w.session?.slot === s.id)) : undefined;
  const repo = s?.cwd ? (s.worktree?.repo ?? holder?.repo ?? s.repo ?? s.cwd) : null;
  // the worktree's row in the last Arbeitsorte read — looked up again at the click, since the read
  // may arrive after the field was drawn
  const rowNow = () => {
    const rows = repo ? workplaces?.repos.find((r) => r.repo === repo)?.worktrees ?? null : null;
    return s && rows ? rows.find((w) => w.session?.slot === s.id) ?? (s.worktree ? null : rows.find((w) => w.primary) ?? null) : null;
  };
  const row = rowNow();
  const up = row?.testinstanz?.state === "up";
  const name = s?.cwd ? nameWithoutModel(s) : "";
  const branch = !s?.cwd ? null : s.worktree?.branch ?? s.git?.branch ?? row?.branch ?? null;
  const rebuild = bundleStaleInfo?.stale === true, restart = deployGapInfo?.codeBehind === true;
  const key = [name, branch ?? "", up, row?.path ?? "", rebuild, restart, repo ?? ""].join("|");
  if (key === wtFieldKey && document.getElementById("compwt")) return;
  wtFieldKey = key;
  const show = () => {
    if (!boardOpen) setBoard(true);
    flashWorkplace(rowNow()?.path ?? null);
  };
  const dot = (): HTMLElement | null => {
    if (!rebuild && !restart) return null;
    const d = el("span", "wtdot");
    d.setAttribute("role", "img");
    d.setAttribute("aria-label", rebuild ? "Seite neu bauen" : "Neustart fällig");
    d.title = [rebuild ? "Seite neu bauen: der Code in diesem Browser ist älter als der Quellcode" : "",
      restart ? "Neustart fällig: der Server läuft auf älterem Code als der Checkout" : ""].filter(Boolean).join(" · ");
    return d;
  };
  const build = (id: string): HTMLButtonElement | null => {
    if (!s?.cwd) return null;
    const b = el("button", "wtfield") as HTMLButtonElement;
    b.id = id;
    b.type = "button";
    b.append(el("span", "wtname", name));
    if (branch) b.append(el("span", "wtsep", "·"), el("span", "wtref", branch));
    const d = dot();
    if (d) b.appendChild(d);
    if (up) b.appendChild(el("span", "wtsq"));
    b.title = `Senden geht an ${name}${branch ? ` auf ${branch}` : ""}${up ? " · Testinstanz läuft" : ""} — Klick zeigt den Arbeitsort in Info`;
    b.setAttribute("aria-label", b.title);
    b.onclick = show;
    return b;
  };
  compTray.querySelector("#compwt")?.remove();
  const desk = build("compwt");
  if (desk) compTray.appendChild(desk);
  const foot = document.getElementById("compfoot");
  if (foot) {
    const phone = build("compfootwt");
    foot.replaceChildren(...(phone ? [phone] : []));
  }
  // the open island's card: where it works — the repo and the branch, only when known
  const mort = document.getElementById("mort");
  if (mort) {
    const where = s?.cwd && (s.git || s.worktree) && repo ? baseName(repo) : "";
    if (!where) { mort.replaceChildren(); return; }
    const b = el("button", "wtfield") as HTMLButtonElement;
    b.id = "mortwt";
    b.type = "button";
    b.append(icon("branch"), el("span", "wtname", where));
    if (branch) b.append(el("span", "wtsep", "·"), el("span", "wtref", branch));
    if (up) b.appendChild(el("span", "wtsq"));
    b.title = `Arbeitsort: ${where}${branch ? ` auf ${branch}` : ""}${up ? " · Testinstanz läuft" : ""} — zeigt ihn in Info`;
    b.setAttribute("aria-label", b.title);
    b.onclick = show;
    mort.replaceChildren(b);
  }
}

// THE NAME COLUMN SHOWS NAMES (owner 2026-10-08, „[Zitat entfernt]“): the switch to
// branches or commits is gone; branch and commit stand in each row's title
// which repo the owner opened or closed by hand (the default: the focused session's repo open, the
// others closed) — a device preference too (fleet.ranke.repos), so the folding survives a reload.
// The unfolded worktrees without a session stay module state: they are a look, not a choice.
const rankeRepos: Map<string, boolean> = (() => {
  const v = prefJSON<unknown>("fleet.ranke.repos");
  const m = new Map<string, boolean>();
  if (v && typeof v === "object" && !Array.isArray(v))
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (typeof x === "boolean") m.set(k, x);
  return m;
})(); // a hand-edited or foreign value is "nothing chosen", not a crash
const rankeFoldOpen = new Set<string>();
// the card on a circle of the git structure: the name the bar shows, the role, agent · model (src/gitstruktur.ts)
const GS_ROLE: Record<string, string> = { "program-main": "Program-MAIN", orchestrator: "Orchestrator" };
const GS_AGENT: Record<string, string> = { claude: "Claude Code", codex: "Codex" };
function gsCard(s: SlotInfo): GsCard {
  const model = s.paneModel ?? s.model ?? null;
  return { name: nameWithoutModel(s), role: s.role ? GS_ROLE[s.role] ?? s.role : s.worktree ? "Lane" : s.spawn?.role === "main" ? "MAIN" : null,
    agent: GS_AGENT[s.harness ?? "claude"] ?? s.harness ?? "Claude Code", model: model ? modelLabel(model) : null };
}
// whether the git structure's legend is open — a look, not a choice; open or closed per repo is rankeRepos above
let gsInfo = false;
// the selected head or diamond and its opened word (src/gitstruktur.ts#GsUi); gsDrawn is what the last paint showed, so
// only what differs unfolds — the poll's repaint leaves an open menu standing still
let gsSel: { repo: string; key: string; word: GsWord | null } | null = null;
let gsDrawn = "";
// THE GEAR OF THE REPOSITORY VIEW (owner Z124 „[Zitat entfernt]“, Z131; Ja 18.10. 22:4x): what
// the structure shows — landed heads, heads without a session — is a device preference (fleet.gs.view), shown by default;
// whether its panel stands open is a look
interface GsView { landed: boolean; idle: boolean }
const gsViewOf = (): GsView => {
  const v = prefJSON<unknown>("fleet.gs.view");
  const o = v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
  return { landed: o.landed !== false, idle: o.idle !== false };
};
let gsView = gsViewOf();
let gsSetOpen = false;
export function reloadGsView(): void { gsView = gsViewOf(); void renderBoard(); }
// the settings window resets the two (src/client.ts#PREF_APPLY): read them again and repaint
export function reloadRankePrefs(): void {
  rankeRepos.clear();
  const v = prefJSON<unknown>("fleet.ranke.repos");
  if (v && typeof v === "object" && !Array.isArray(v))
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (typeof x === "boolean") rankeRepos.set(k, x);
  void renderBoard();
}
// ONE open line under a row: `wt:<path>` (a worktree without a session) or `ti:<path>` (its test instance)
let rankeOpen: string | null = null;
// the worktree field under the composer: show this worktree in Info
export function flashWorkplace(path: string | null): void {
  loadWorkplaces(true);
  void renderBoard();
}
const tiBusy = new Set<string>();
const tiErr = new Map<string, string>();

// THE LIVE SESSION (owner 2026-10-09: „[Zitat entfernt]“
// ): one sentence at a
// project starts a lane, hands it the sentence, and starts the lane's own test instance; the lane's
// row then carries Live, Öffnen and Mergen. Only doors that exist: POST /api/lanes, POST /send,
// POST /api/slots/:id/testinstanz and src/board.ts#doLand (its Rückfrage, then /merge).
// WHAT MAKES A LANE LIVE is its branch prefix and nothing else, read HERE and nowhere else: without
// a server field of its own (the card forbids a new route) the branch is the one fact a reload, a
// second device and a successor session all see the same — decided with the UI-MAIN 2026-10-09.
const LIVE_BRANCH_PREFIX = "fleet/live-";
export function isLiveLane(branch: string | null | undefined): boolean {
  return !!branch && branch.startsWith(LIVE_BRANCH_PREFIX);
}
// what the session reads under the owner's sentence (UI-MAIN 2026-10-09: the sentence, a short fixed
// paragraph, the profile's path — never the 376-line profile itself). No backticks: a test instance's
// stand-in pane is a shell that would run them. `bun install` first: a fresh
// worktree has no node_modules, and testinstanz.sh links the worktree's own, so its build fails
// without them (measured in this lane 2026-10-09: „[Zitat entfernt]“).
export const LIVE_SESSION_NOTE = [
  "Live-Session: Der Owner arbeitet in deiner Testinstanz mit und spricht in diese Pane. Seine Worte gehen vor.",
  "Zuerst bun install --frozen-lockfile (falls das Repo eine package.json hat): deine Testinstanz startet von selbst und baut aus diesem Worktree.",
  "Zwischen den Runden nur ./testinstanz.sh refresh und Durchklicken, keine Suiten.",
  "Vor einem Report ein Commit; berichtet wird an der Rundengrenze.",
  "Gemergt wird erst, wenn der Owner an deiner Lane „Mergen“ drückt.",
  "Nachlesen: docs/design/live-bau-profil-2026-10.md §2.",
].join("\n");
// WHAT STARTEN DOES, from the sentence to Mergen (owner 2026-10-09: „[Zitat entfernt]“
// 
// ): the four steps of #startLiveSession and
// #doLand, behind the field's ⓘ
const LIVE_HOW = [
  "Start creates a lane: its own worktree on a branch fleet/live-…, with a new session in it as in every lane.",
  "Your sentence goes word for word as the first message to that session, followed by a fixed paragraph on how live building works — the session reads it as its task, no other model rewrites it first.",
  "Its test instance starts by itself and runs for four hours; Open stands at the lane. You talk in the session's pane, it builds, commits and refreshes its test instance.",
  "At the end you press “Merge” at the lane: first the question with the diff, then the server checks the lane and lands it on its target.",
];
let liveHowOpen = false;
// the branch of a new live lane: the prefix, a minute stamp, the sentence's first words, a hex tail
function liveBranch(text: string): string {
  const d = new Date(), p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`;
  const words = text.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean).slice(0, 4).join("-").slice(0, 32).replace(/-+$/, "");
  const hex = Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  return `${LIVE_BRANCH_PREFIX}${stamp}${words ? `-${words}` : ""}-${hex}`;
}
// the open field under a project's head (one at a time), the start running per repo, and what failed:
// keyed by repo while no lane exists yet, by the lane's worktree path once it does — the lane stays
let liveDraft: { repo: string; text: string } | null = null;
const liveBusy = new Set<string>();
const liveErr = new Map<string, string>();
// THE NEW LANE'S WAY IN (owner 2026-10-09: „[Zitat entfernt]“
// 
// ): from Starten until the lane's own row is drawn, the field holds its
// sentence and a bar stands under it (#liveGhost) until the git structure draws the lane. `path` is
// the lane's worktree once it exists; past `until` the bar gives up and the lane simply appears.
let liveArrive: { repo: string; sentence: string; path: string | null; until: number } | null = null;
function liveArriving(repo: string, rows: WorkplaceRow[]): NonNullable<typeof liveArrive> | null {
  const a = liveArrive;
  return a && a.repo === repo && a.until > Date.now() && !rows.some((w) => w.path === a.path) ? a : null;
}
// a test instance's first `up` races the session's `bun install`: one more try after this pause
const LIVE_TI_RETRY_MS = 60_000;
// server.ts#MAX_LABEL is 40, "⎇ " takes two of them
const LIVE_LABEL_MAX = 38;
const errText = async (r: Response): Promise<string> => {
  const j = (await r.json().catch(() => ({}))) as { error?: string; refusal?: string };
  return j.error ?? j.refusal ?? `HTTP ${r.status}`;
};
async function startLiveSession(repo: string, text: string): Promise<void> {
  const sentence = text.trim();
  if (!sentence || liveBusy.has(repo)) return;
  liveBusy.add(repo);
  liveErr.delete(repo);
  liveArrive = { repo, sentence, path: null, until: Date.now() + 120_000 };
  void renderBoard();
  // 1 — the lane
  let slot: number, cwd: string;
  try {
    const r = await post("/api/lanes", { repo, branch: liveBranch(sentence) });
    const j = (await r.clone().json().catch(() => ({}))) as { slot?: number; cwd?: string };
    if (!r.ok || !j.slot || !j.cwd) throw new Error(await errText(r));
    slot = j.slot; cwd = j.cwd;
  } catch (error) {
    liveErr.set(repo, `The live session did not start: ${error instanceof Error ? error.message : String(error)}.`);
    liveBusy.delete(repo);
    liveArrive = null;
    void renderBoard();
    return;
  }
  // the bar waits under the field for the lane's own row — a reload of the Arbeitsorte away
  liveArrive = { repo, sentence, path: cwd, until: Date.now() + 20_000 };
  liveDraft = null;
  liveBusy.delete(repo);
  rankeRepos.set(repo, true);
  // the lane just started stands opened once, so its instance and Mergen are in sight without a search
  rankeOpen = `wt:${cwd}`;
  // the lane is called by its sentence, not by its branch's stamp (the server caps a label at 40);
  // a refused rename leaves the server's own name, which is no failure of the three steps
  const label = `⎇ ${sentence.length > LIVE_LABEL_MAX ? `${sentence.slice(0, LIVE_LABEL_MAX - 1).trimEnd()}…` : sentence}`;
  await post(`/api/slots/${slot}/rename`, { label }).catch(() => undefined);
  await refresh().catch(() => undefined);
  loadWorkplaces(true);
  // 2 — the sentence into the session, parked until its composer is free; pinned to THIS occupant
  try {
    const openedAt = fleet[slot - 1]?.openedAt;
    const r = await post("/send", { slot, text: `${sentence}\n\n${LIVE_SESSION_NOTE}`, whenFree: true, ...(openedAt ? { openedAt } : {}) });
    if (!r.ok) throw new Error(await errText(r));
  } catch (error) {
    liveErr.set(cwd, `The task did not reach the session (${error instanceof Error ? error.message : String(error)}) — the lane stands, write it into its session.`);
  }
  // 3 — its own test instance, once more after the session had time for `bun install`
  tiBusy.add(cwd);
  void renderBoard();
  const up = () => post(`/api/slots/${slot}/testinstanz`, { action: "up", ttlMin: 240 });
  try {
    let r = await up();
    if (!r.ok) {
      await new Promise((ok) => setTimeout(ok, LIVE_TI_RETRY_MS));
      r = await up();
    }
    if (!r.ok) throw new Error(await errText(r));
  } catch (error) {
    liveErr.set(cwd, `${liveErr.get(cwd) ? `${liveErr.get(cwd)} ` : ""}The test instance did not start (${error instanceof Error ? error.message : String(error)}) — the lane stands, its test instance line starts it again.`);
  } finally {
    tiBusy.delete(cwd);
    loadWorkplaces(true);
  }
}
// THE LAND FORM (owner 2026-10-09: „[Zitat entfernt]“
// 
// ): the two forms the server knows
// (server.ts#landSwitchesFrom, {squash}) — the commits as they were made, or one commit at the land. A
// project's default over the whole view (the Projekte block's head: a gear in a project's own head left
// its name 53 px on the phone), a lane's own in the opened lane; kept in this browser
// (fleet.board.landform). A NUMBER of commits is no form the server has. Since d5657b56 every gated land
// is ONE commit unless the call names {"squash":false} (docs/self-api.md, "Der Schalter squash"), so a
// choice not made reads "ein Commit". Mergen (#doLand) sends {"squash":false} for "alle Commits" and no
// switch otherwise; ⏏ and the confirm of a conflict resolution answer 409 to a named squash:true and get
// none. A MAIN's land door never sees a choice kept in this browser. The field says so behind its ⓘ
// (owner 2026-10-09: „[Zitat entfernt]“).
type LandForm = "commits" | "squash";
const LAND_FORM_WORD: Record<LandForm, string> = { commits: "All commits", squash: "One commit" };
// what "ein Commit" means since d5657b56: the land is one commit S described from the accepted report, a
// lane of one commit too; the series stays under the lane's history ref, a series with a merge commit lands as it is
const LAND_FORM_SAY: Record<LandForm, string> = { commits: "The commits land as they were made",
  squash: "The lane lands as one commit, described anew from the accepted report — a lane of one commit too; its series stays in the lane's history, a series with a merge commit lands unchanged" };
const LAND_FORM_NOTE = "Holds when you land the lane from this board: “One commit” folds the lane's work into one commit, “All commits” takes each one. When another session lands the lane, it becomes one commit regardless.";
type LandForms = { repo: Record<string, LandForm>; lane: Record<string, LandForm> };
// the sentence on where the choice holds, open behind the field's ⓘ; closing the gear closes it too
let landFormInfo = false;
function landForms(): LandForms {
  const v = prefJSON<unknown>("fleet.board.landform");
  const pick = (o: unknown): Record<string, LandForm> => Object.fromEntries(Object.entries(o && typeof o === "object" ? o : {})
    .filter((e): e is [string, LandForm] => e[1] === "commits" || e[1] === "squash"));
  const o = v && typeof v === "object" ? v as Partial<Record<keyof LandForms, unknown>> : {};
  return { repo: pick(o.repo), lane: pick(o.lane) };
}
// a lane's own form, or its project's, or the server's default: one commit
function landFormOf(repo: string, path: string | null): { form: LandForm; own: boolean } {
  const f = landForms();
  const own = path ? f.lane[path] : undefined;
  return own ? { form: own, own: true } : { form: f.repo[repo] ?? "squash", own: false };
}
function setLandForm(kind: keyof LandForms, key: string, form: LandForm | null): void {
  const f = landForms();
  const next = { ...f, [kind]: { ...f[kind] } };
  if (form) next[kind][key] = form; else delete next[kind][key];
  prefSet("fleet.board.landform", JSON.stringify(next));
  void renderBoard();
}
// the choice under the Projekte head (one line per project shown) or the opened lane: a lane may also
// follow its project; an ⓘ after the last choice opens the one sentence on where it holds
function landFormField(kind: keyof LandForms, key: string, repo: string, label: string, note: boolean): HTMLElement {
  const box = el("div", `zd lf-set ${kind}`);
  box.dataset.for = key;
  const now = kind === "repo" ? { form: landFormOf(repo, null).form, own: true } : landFormOf(repo, key);
  box.appendChild(el("span", "lf-k", label));
  const choice = (word: string, title: string, on: boolean, form: LandForm | null) => {
    const c = el("button", `rk-btn quiet lf-c${on ? " on" : ""}`, word) as HTMLButtonElement;
    c.type = "button";
    c.title = title;
    c.setAttribute("aria-pressed", String(on));
    c.onclick = (e) => { e.stopPropagation(); setLandForm(kind, key, form); };
    return c;
  };
  if (kind === "lane") box.appendChild(choice("Like the project", `Like the project: ${LAND_FORM_WORD[landFormOf(repo, null).form].toLowerCase()}`, !now.own, null));
  // a lane's own two forms as one group: they wrap together, never one alone (src/gitstruktur.ts, .lf-own)
  const own = kind === "lane" ? el("span", "lf-own") : box;
  for (const form of ["commits", "squash"] as const) own.appendChild(choice(LAND_FORM_WORD[form], LAND_FORM_SAY[form], now.own && now.form === form, form));
  if (own !== box) box.appendChild(own);
  if (note) {
    const i = el("button", `rk-btn quiet ib lf-i${landFormInfo ? " on" : ""}`) as HTMLButtonElement;
    i.type = "button";
    i.appendChild(icon("info"));
    i.title = landFormInfo ? "Close the explanation" : "Where this choice holds";
    i.setAttribute("aria-label", "Where this choice holds");
    i.setAttribute("aria-expanded", String(landFormInfo));
    i.onclick = (e) => { e.stopPropagation(); landFormInfo = !landFormInfo; void renderBoard(); };
    box.appendChild(i);
    if (landFormInfo) box.appendChild(el("div", "hint lf-hint", LAND_FORM_NOTE));
  }
  return box;
}
// A BOARD BRANCH'S LAND FORM, kept on the server (K16): one commit, or every commit as the merge check built
// them; a repo without a merge check offers only the one commit
function branchLandFormField(repo: string, b: BranchView, repaint: () => void): HTMLElement {
  const box = el("div", "zd lf-set branch");
  box.dataset.for = b.branch;
  box.appendChild(el("span", "lf-k", "On land"));
  for (const form of ["commits", "squash"] as const) {
    const off = form === "commits" && b.check === null;
    const on = !off && b.landForm === form;
    const c = el("button", `rk-btn quiet lf-c${on ? " on" : ""}`, LAND_FORM_WORD[form]) as HTMLButtonElement;
    c.type = "button";
    c.disabled = off;
    c.title = off ? "All commits only with a merge check — this repo has none"
      : form === "commits" ? "The commits land one by one, as the merge check set them onto main" : "The commits since the last batch land as one commit";
    c.setAttribute("aria-pressed", String(on));
    c.onclick = (e) => { e.stopPropagation(); if (!on) void chooseLandForm(repo, b, form, repaint); };
    box.appendChild(c);
  }
  return box;
}
// the bar under the field while the lane is made: the sentence as the lane will be called, Live, and
// what is happening
function liveGhost(a: NonNullable<typeof liveArrive>): HTMLElement {
  const g = el("div", "zd live-ghost");
  g.dataset.for = a.repo;
  const tx = el("span", "tx", a.sentence.length > LIVE_LABEL_MAX ? `${a.sentence.slice(0, LIVE_LABEL_MAX - 1).trimEnd()}…` : a.sentence);
  tx.appendChild(el("span", "livetag", "Live"));
  g.append(el("span", "nd"), tx, el("span", "st", a.path ? "lane stands" : "being created…"));
  g.title = "The lane is being created — in a moment it stands in its project's structure";
  return g;
}
// under a project's head while its field is open: the sentence, Starten, and what failed before a lane existed
function liveField(repo: string, arrive: NonNullable<typeof liveArrive> | null): HTMLElement {
  const box = el("div", "zd live-new");
  box.dataset.for = repo;
  // until the lane's row is drawn the field holds its sentence, as it was sent
  const busy = liveBusy.has(repo) || !!arrive;
  const f = el("input", "live-in") as HTMLInputElement;
  f.type = "text";
  f.placeholder = "Task in one sentence";
  f.setAttribute("aria-label", "Task in one sentence");
  f.value = arrive ? arrive.sentence : liveDraft?.repo === repo ? liveDraft.text : "";
  f.disabled = busy;
  f.oninput = () => { liveDraft = { repo, text: f.value }; go.disabled = busy || !f.value.trim(); };
  f.onkeydown = (e) => { if (e.key === "Enter" && f.value.trim()) { e.preventDefault(); void startLiveSession(repo, f.value); } };
  f.onclick = (e) => e.stopPropagation();
  const go = el("button", "rk-btn primary", busy ? "starting…" : "Start") as HTMLButtonElement;
  go.type = "button";
  go.title = "Create a lane, give it the sentence and start its test instance";
  go.disabled = busy || !f.value.trim();
  go.onclick = (e) => { e.stopPropagation(); void startLiveSession(repo, f.value); };
  const how = el("button", `rk-btn quiet ib live-i${liveHowOpen ? " on" : ""}`) as HTMLButtonElement;
  how.type = "button";
  how.appendChild(icon("info"));
  how.title = liveHowOpen ? "Close the explanation" : "What Start does, from the sentence to the merge";
  how.setAttribute("aria-label", "What Start does");
  how.setAttribute("aria-expanded", String(liveHowOpen));
  how.onclick = (e) => { e.stopPropagation(); liveHowOpen = !liveHowOpen; void renderBoard(); };
  box.append(f, go, how);
  // what this start is, beside the + that opens the founding window: one line, not a manual
  box.appendChild(el("div", "hint live-hint", "A lane with its own test instance · merge at the end"));
  if (liveHowOpen) box.appendChild(LIVE_HOW.reduce((ol, t) => { ol.appendChild(el("li", "", t)); return ol; }, el("ol", "hint live-how")));
  const err = liveErr.get(repo);
  if (err) box.appendChild(el("div", "err", err));
  return box;
}
// what failed while a live session started stands under its lane, opened or not: it is the one
// sentence that says why the lane has no instance or never got its sentence
function liveErrLine(w: WorkplaceRow): HTMLElement | null {
  const err = liveErr.get(w.path);
  if (!err) return null;
  const line = el("div", "zd live-err");
  line.dataset.for = w.path;
  line.appendChild(el("span", "err", err));
  return line;
}

// THE COLUMN'S STYLE FOR THIS ROUND (lane 60fe7c87, owner 2026-10-09): the live session's field and
// mark, each lane's way back with the diamond of its running check, the short checks block and the
// mark of the server this page comes from. Bundled into app.js and hung into <head> once by
// #initBoard: public/index.html stands at its byte baseline (e2e/bytes.ts reports it). Tokens only (grammatik
// G0.1), and Info keeps its own 12 px — nothing here reads --chat-ui-fs.
const RANKE_CSS = `
  #board .rk-btn.live-btn { gap: 0; }
  #board .rk-btn.live-btn.on { color: var(--chat-ink); }
  #board .zd.live-new { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 2px 0 6px var(--rk-rail); }
  #board .zd.live-new .live-in { flex: 1 1 180px; min-width: 0; min-height: 22px; padding: 0 7px; border: 1px solid var(--chat-edge);
    border-radius: var(--r1); background: var(--chat-surface); color: var(--chat-ink); font: inherit; }
  #board .zd.live-new .live-in:focus { outline: none; border-color: var(--c-edge-hi); }
  #board .zd.live-new > .err, #board .zd.live-new > .live-hint { flex-basis: 100%; }
  #board .zd.live-new > .live-hint { margin: 0; padding: 0 2px; color: var(--chat-faint); }
  #board .zd.live-new > .rk-btn.live-i.on { color: var(--chat-ink); }
  #board .zd.live-new > .live-how { flex-basis: 100%; margin: 2px 0 0; padding: 0 2px 0 1.4em; color: var(--chat-mute); white-space: normal; }
  #board .zd.live-new > .live-how li + li { margin-top: 3px; }
  /* THE NEW LANE'S BAR while it is made (#liveGhost): a lane's row in the surface of an opened one, its point
     breathing until the lane's own row takes its place and slides in from here */
  #board .zd.live-ghost { min-height: var(--rk-row); margin: 0 0 4px; border-radius: 4px; background: var(--chat-surface); }
  #board .zd.live-ghost > .nd { grid-column: 1; justify-self: center; width: 7px; height: 7px; border-radius: 50%; background: var(--q-live);
    animation: live-breathe 1.2s ease-in-out infinite; }
  #board .zd.live-ghost > .tx { grid-column: 2 / 4; min-width: 0; color: var(--chat-ink); white-space: normal; overflow-wrap: anywhere; }
  #board .zd.live-ghost .livetag { display: inline-block; margin-left: 6px; padding: 0 5px; border: 1px solid var(--chat-edge); border-radius: var(--r1);
    color: var(--chat-ink); font-size: 0.85em; line-height: 1.2; vertical-align: 1px; white-space: nowrap; }
  #board .zd.live-ghost > .st { grid-column: 4 / -1; justify-self: end; padding-right: 8px; color: var(--chat-faint); white-space: nowrap; }
  @keyframes live-breathe { 50% { opacity: 0.3; } }
  @media (prefers-reduced-motion: reduce) { #board .zd.live-ghost > .nd { animation: none; } }
  #board .zr.zw .nm .livetag { display: inline-block; margin-left: 6px; padding: 0 5px; border: 1px solid var(--chat-edge); border-radius: var(--r1);
    color: var(--chat-ink); font-size: 0.85em; line-height: 1.2; vertical-align: 1px; white-space: nowrap; }
  /* THE LAND FORM (#landFormField): the gear in a project's head and at the end of an opened lane's way;
     its choice under it, the form in force pressed, one line saying where it holds */
  #board .rk-btn.lf-btn.on { color: var(--chat-ink); }
  #board .zd.wl.lf > .tx { grid-column: 3 / 4; }
  #board .zd.wl.lf > .lf-btn { grid-column: 4 / 6; justify-self: end; }
  #board .zd.lf-set { display: flex; align-items: center; gap: 4px 2px; flex-wrap: wrap; padding: 2px 0 6px var(--rk-rail); }
  #board .zd.lf-set.lane { padding-left: calc(var(--rk-rail) + var(--rk-ref) + 8px); }
  #board .zd.lf-set > .lf-k { flex-basis: 100%; color: var(--chat-prose); }
  #board .zd.lf-set > .rk-btn.lf-c { padding: 0 4px; }
  #board .zd.lf-set > .rk-btn.lf-c.on { border-color: var(--c-edge-hi); background: var(--chat-surface); color: var(--chat-ink); }
  #board .zd.lf-set > .lf-hint { flex-basis: 100%; margin: 0; padding: 0 2px; color: var(--chat-faint); white-space: normal; }
  #board .zd.lf-set > .rk-btn.lf-i.on { color: var(--chat-ink); }
  #board .zd.live-merge { display: flex; justify-content: flex-end; padding: 0 0 4px calc(var(--rk-rail) + var(--rk-ref) + 8px); }
  #board .zd.live-err { display: block; padding: 0 0 6px calc(var(--rk-rail) + var(--rk-ref) + 8px); }
  #board .zd.live-err > .err { color: var(--danger); white-space: normal; overflow-wrap: anywhere; }
  /* GERÄTE, ONE SPACING (owner 2026-10-09: „[Zitat entfernt]“): the machines' groups follow each
     other like their rows do — the gap after this machine's group read as a second list */
  #board .ranke .rk-dev .grp + .grp { margin-top: 0; }
  /* AN INSTANCE UNDER ITS DEVICE (#asInstance): one rail in and a step smaller, so its glyph stands under
     the device's name — Live-Server and Testinstanz under the Mac, a linked Fleet under its machine */
  #board .zr.mach.inst { margin-left: var(--rk-rail); font-size: 0.93em; }
  #board .zr.mach.inst .fx .ico { width: 12px; height: 12px; }
  #board .zr.mach.inst > .zs { font-size: inherit; }
  #board .zd.mx.inst { padding-left: calc(2 * var(--rk-rail) + 4px); font-size: 0.93em; }
  #board .rklegend .lgl .zs .q { color: var(--chat-faint); font-weight: 400; }
  #board .zd.run .w .nw { white-space: nowrap; }
  #board .gd { display: inline-block; flex: none; width: 7px; height: 7px; border-radius: 1px; transform: rotate(45deg);
    box-shadow: inset 0 0 0 1.5px var(--chat-ink); }
  #board [data-gate="run"] > .gd, #board [data-gate="run"] > .tx > .gd { background: var(--chat-ink); box-shadow: none; }
  #board [data-gate="ok"] > .gd { background: var(--q-live); box-shadow: none; }
  #board [data-gate="bad"] > .gd { background: var(--danger); box-shadow: none; }
  #board [data-gate="unk"] > .gd { box-shadow: inset 0 0 0 1.5px var(--amber); }
  #board .gw i.unk { box-shadow: inset 0 0 0 1.25px var(--amber); }
  #board .gw i.old { background: transparent; }
  #board .gw i.ok.old { box-shadow: inset 0 0 0 1.25px var(--q-live); }
  #board .gw i.bad.old { box-shadow: inset 0 0 0 1.25px var(--danger); }
  /* THE CHECKS FOLD (#runsSummary): the block's head opens and closes it; closed, one line */
  #board .rkblock.rk-git + .rkblock.rk-runs { margin-top: 6px; padding-top: 0; border-top: 0; }
  /* a session outside every repo has no structure, and with no run the checks block hides: Geräte opens Info, no rule above */
  #board .rk-runs:first-child:not(:has(.rkruns > *)) + .rkblock { margin-top: 0; padding-top: 0; border-top: 0; }
  #board .rk-runs > .rkbh.fold { cursor: pointer; border-radius: var(--r1); }
  #board .rk-runs > .rkbh.fold > .ico { margin-left: auto; width: 12px; height: 12px; color: var(--chat-faint); transform: rotate(-90deg); transition: transform var(--t); }
  #board .rk-runs > .rkbh.fold[aria-expanded="true"] > .ico { transform: none; }
  #board .rk-runs > .rkbh.fold:focus-visible { outline: 1px solid var(--chat-mute); outline-offset: 1px; }
  #board .zd.run.sum { cursor: pointer; }
  #board .zd.run.sum > .tx { display: flex; align-items: center; gap: 9px; }
  #board .zd.run.sum .gds { display: inline-flex; align-items: center; gap: 6px; padding-left: 2px; }
  #board .zd.run.sum .gq { display: inline-flex; }
  #board .zd.run.sum .w { color: var(--chat-ink); }
  #board [data-gate="queue"] > .gd { background: var(--chat-void); }
  /* the checks block: one line per run — what, where, whose */
  #board .zd.run.free > .tx { display: flex; flex-wrap: wrap; align-items: center; column-gap: 8px; row-gap: 0; }
  #board .zd.run.free .gd { margin: 0 2px; }
  #board .zd.run.free .w { color: var(--chat-ink); }
  #board .zd.run.free .dv { display: inline-flex; align-items: center; gap: 3px; margin: 0; color: var(--chat-prose); }
  #board .zd.run.free .dv .q { color: var(--chat-faint); }
  #board .zd.run.free .who { display: inline-flex; align-items: baseline; gap: 4px; margin: 0; font-weight: 400; color: var(--chat-mute); }
  @media (max-width: 700px), ((pointer: coarse) and (max-height: 500px)) {
    #board .rk-btn.live-btn .lx { display: none; }
    #board .zd.live-new .live-in { min-height: 40px; font-size: 16px; }
    #board .zd.live-merge { justify-content: flex-start; }
  }
`;

const sha7 =(h: string | null | undefined): string | null => (h ? h.slice(0, 7) : null);
const refShort = (ref: string): string => ref.replace(/^refs\/(heads|remotes)\//, "");
// "fleet/261004-zeitleiste-c3d4" → "zeitleiste": the words of a branch without its date and hex
// (owner 2026-10-04: the lane's name, not a hex tail). A date stands anywhere in the name as a stamp
// (261004, 260920214010) or a day (2026-10-04); a name of a date and a hex alone says the day it was
// cut (owner 2026-10-07: „[Zitat entfernt]“ twice told nothing). Without a branch the worktree is detached.
export function laneWords(branch: string | null): string {
  if (!branch) return "detached";
  const bare = branch.replace(/^fleet\//, "");
  const words = bare.replace(/(^|[-_/])(?:\d{6,}|(?:19|20)\d\d-\d\d-\d\d)(?=[-_/]|$)/g, "$1")
    .replace(/[-_/][0-9a-f]{4,}$/, "").replace(/[-_/]+/g, " ").trim();
  if (words && !/^(?=.*\d)[0-9a-f]{4,}$/.test(words)) return words;
  const day = branchDay(bare);
  return day ? `branch of ${day}` : branch;
}
// the day in a branch name, "20.09.": a stamp yymmdd[hhmm…] or a yyyy-mm-dd, read only when it is one
export function branchDay(branch: string): string | null {
  const m = /(?:^|[-_/])(?:(?:19|20)\d\d-(\d\d)-(\d\d)|\d\d(\d\d)(\d\d)\d*)(?=[-_/]|$)/.exec(branch);
  if (!m) return null;
  const mm = Number(m[1] ?? m[3]), dd = Number(m[2] ?? m[4]);
  return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 ? `${String(dd).padStart(2, "0")}.${String(mm).padStart(2, "0")}.` : null;
}
// the board speaks German, so its clock does too — "14:26", never "02:26 PM" from a browser's English locale
const clockOf = (ms: number): string => new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
// the same span in the git structure's English (owner Z87: „[Zitat entfernt]“)
const agoEn = (ms: number): string => ms < 60_000 ? "a moment" : ms < 3_600_000 ? `${Math.round(ms / 60_000)} min`
  : ms < 86_400_000 ? `${Math.round(ms / 3_600_000)} h` : `${Math.round(ms / 86_400_000)} d`;
export function agoDe(ms: number): string {
  const min = Math.round(Math.max(0, ms) / 60_000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  return h < 36 ? `vor ${h} Std.` : `vor ${Math.round(h / 24)} Tagen`;
}

const CHECK_WORD: Record<WorkplaceCheck["state"], string> = {
  green: "green", red: "red", running: "running", waiting: "waiting for a run", skipped: "skipped",
};
// one stage's state in words, for the lane's title: what the five beads said, now read aloud
function stageSay(w: WorkplaceRow, stage: keyof WorkplaceChecks, word: string): string {
  const c = w.checks?.[stage] ?? null;
  if (!c) {
    const why = w.reasons.find((r) => r.field === `checks.${stage}`)?.reason ?? "";
    return `${word}: ${/unreadable|malformed|capped|unmeasured/.test(why) ? "unknown — the record is not readable" : "none known yet"}`;
  }
  // the check after the land names the INTEGRATION commit, never this worktree's HEAD: "stale" there
  // says nothing about the lane and is not said
  const bits = [`${word}: ${CHECK_WORD[c.state]}`];
  if (c.at) bits.push(`${agoEn(Date.now() - c.at)} ago`);
  if (stage !== "audit" && c.stale === true) bits.push("on an older state than this worktree");
  if (c.fails.length) bits.push(c.fails.slice(0, 3).join(", "));
  return bits.join(" · ");
}
// IN ITS TARGET — the owner's question of 2026-10-04 („[Zitat entfernt]“
// ), answered from WorkplaceRow.target only: a land note proves "yes", own commits
// without one say "no", everything else is unknown or nothing to land
function landedSay(w: WorkplaceRow): string {
  const t = w.target;
  if (t.landed === "yes") return `landed as ${sha7(t.landedAs) ?? "unknown"} in ${t.branch}`;
  if (t.landed === "no") return `not on ${t.branch} yet`;
  if (w.reasons.some((r) => r.field === "target.landed" && r.reason === "nothing-to-land")) return `nothing to land — no own commits over ${t.branch}`;
  return `unknown whether landed on ${t.branch}`;
}
// THE LANE'S WAY AS FOUR POINTS (owner 2026-10-08: „[Zitat entfernt]“
// 
// ; 2026-10-09: „[Zitat entfernt]“):
// local proof, preview, land check, the check after the land — in the order a lane goes them. That it
// LANDED is no point of its own any more: the way back says it, dashed until the land and its check
// after the land are through (#laneRow, #auditOf). The check after the land runs for every land that
// moves its target (server.ts#schedulePostLandAudit, overhaul too), so every row that lands carries
// all four; a card inside a card group lands with its group and carries none of its own (#groupLines).
// In their colours: filled green passed, red failed, ink runs, an ink ring waits, a faint dot has
// nothing yet, an amber ring is unreadable, a ring in a state's colour is that state on an OLDER stand
// than the worktree. The words, in order, are the title (hover), the held word (a finger,
// src/board.ts#holdTip) and the aria-label; the title ends with where the land stands.
const WAY: { key: keyof WorkplaceChecks; word: string }[] = [
  { key: "local", word: CHECK_KIND.proof }, { key: "preview", word: CHECK_KIND.preview }, { key: "gate", word: CHECK_KIND.landCheck },
  { key: "audit", word: CHECK_KIND.afterLand },
];
// THE CHECK AFTER A LAND, while it is not through (server.ts#postLandAuditLiveView): "run" while the
// running audit covers this branch's land, "queue" while the land waits for the next run — read by
// branch, the name the server's covers carry
function auditOf(branch: string | null): "run" | "queue" | null {
  const a = postLandLive;
  if (!branch || !a) return null;
  if (a.running?.covers.includes(branch)) return "run";
  return a.waiting.some((x) => x.branch === branch) ? "queue" : null;
}
const WAY_CLASS: Record<WorkplaceCheck["state"], string> = { green: "ok", red: "bad", running: "run", waiting: "queue", skipped: "skip" };
// WHICH POINT A RUN IS (src/suitemeter.ts#meterKind): a gate script a session handed to a helper is
// its proof, a preview its preview, a land check its land check. A run the lane's checks do not say
// yet (a preview the lane reported itself) runs or waits at its point all the same — the diamond and
// the opened lane then show one way. A queued run without a kind is at no point.
const RUN_POINT: Record<string, keyof WorkplaceChecks> = { "gate script": "local", preview: "preview", "land check": "gate" };
function wayPoint(w: WorkplaceRow, key: keyof WorkplaceChecks, word: string, mine: MeterBall[] = []): { cls: string; say: string } {
  const c = w.checks?.[key] ?? null;
  // the land's own check after the land, while the server's audit covers it or still waits for it
  const after = key === "audit" && w.target.landed === "yes" && c?.state !== "running" && c?.state !== "waiting" ? auditOf(w.branch) : null;
  if (after) return { cls: after, say: `${word}: ${after === "run" ? "running" : "waiting for the next run"} · for the land into ${w.target.branch}` };
  const run = c?.state === "running" || c?.state === "waiting" ? undefined
    : mine.find((b) => b.station !== "done" && RUN_POINT[b.kind] === key);
  if (run) return { cls: run.station === "wait" ? "queue" : "run", say: `${word}: ${run.station === "wait" ? "waiting" : "running"}${run.what ? ` · ${run.what}` : ""}` };
  const say = stageSay(w, key, word);
  if (!c) return { cls: /unknown/.test(say) ? "unk" : "none", say };
  return { cls: `${WAY_CLASS[c.state]}${key !== "audit" && c.stale === true ? " old" : ""}`, say };
}
function laneWay(w: WorkplaceRow, mine: MeterBall[] = []): HTMLElement {
  const box = el("span", "way");
  const says: string[] = [];
  WAY.forEach(({ key, word }, i) => {
    const p = wayPoint(w, key, word, mine);
    const d = el("i", p.cls);
    d.dataset.key = key;
    box.appendChild(d);
    says.push(`${i + 1} ${p.say}`);
  });
  says.push(`Land: ${landedSay(w)}`);
  box.setAttribute("role", "img");
  box.setAttribute("aria-label", `Way to ${w.target.branch}: ${says.join(". ")}`);
  box.title = says.join("\n");
  box.dataset.hold = box.title;
  return box;
}
const WAY_CHECKS = WAY;
const redStages = (w: WorkplaceRow) => WAY_CHECKS.filter(({ key }) => w.checks?.[key]?.state === "red");
// THE DIAMOND (owner 2026-10-09 in the test instance: „[Zitat entfernt]“
// 
// ; first built 2026-10-08 in 954fd904 and taken back with that night's UI): a lane's check
// ON the lane's way back to its target, right beside the row's last mark (owner, the same day: „[Zitat entfernt]“
// ; placed by
// #drawRankeLines). ITS COLOURS (owner, the same day: „[Zitat entfernt]“; on 2026-10-08: „[Zitat entfernt]“
// ): filled
// ink while one runs (here or on a helper), an ink ring while one only waits, and for the server's
// last minutes after its runs ended filled green, filled red, or an amber ring without a result —
// then it goes, and what the checks came to stands at the opened lane's points (#wayLine). Read from the runs naming the lane
// (MeterBall) and the checks' own states. NOT THE CHECK AFTER THE LAND (owner 2026-10-10: „[Zitat entfernt]“
// ): it measures the
// stem's tip and covers every land since the run before, so it is the stem's diamond (#stemAudit) and
// never a lane's, its own land's neither — a landed lane only keeps its way back dashed until it is through
type GateLook = "run" | "queue" | "ok" | "bad" | "unk";
const endedLook = (b: MeterBall): GateLook => (b.tone === "ok" ? "ok" : b.tone === "red" ? "bad" : "unk");
const LANE_CHECKS = WAY.filter(({ key }) => key !== "audit");
function gateLook(w: WorkplaceRow, mine: MeterBall[], ended: MeterBall[] = []): GateLook | null {
  const states = LANE_CHECKS.map(({ key }) => w.checks?.[key] ?? null);
  if (states.some((c) => c?.state === "running") || mine.some((b) => b.station === "run" || b.station === "helper")) return "run";
  if (states.some((c) => c?.state === "waiting") || mine.some((b) => b.station === "wait")) return "queue";
  // green only where every run that just ended passed; a red one says red
  const looks = ended.map(endedLook);
  return looks.includes("bad") ? "bad" : looks.includes("unk") ? "unk" : looks.length ? "ok" : null;
}
// THE STEM'S CHECK AFTER THE LAND (owner 2026-10-09: „[Zitat entfernt]“
// ): the audit measures a stem's newest tip after a land,
// folded over every land since the run before (server.ts#schedulePostLandAudit) — so it is the STEM's
// own diamond and no lane's (#gateLook): at the END of a dashed line from its row to the right, just
// before its head (owner 2026-10-10: „[Zitat entfernt]“
// ; placed by #drawRankeLines) — ink while it runs, an ink ring
// while lands wait for it. The server names the repo by its basename
// (server.ts#postLandAuditLiveView), so a repo matches by its full path, or by a basename no other
// project on this board shares — a run placed by a guess is worse than one left in Prüfungen.
type StemAudit = { look: "run" | "queue"; lines: { look: "run" | "queue"; head: string; more: string }[]; balls: MeterBall[] };
function stemAudit(R: WorkplaceRepo, stem: string): StemAudit | null {
  const a = postLandLive;
  if (!a) return null;
  const name = baseName(R.repo);
  const mine = (repo: string | null) => repo === R.repo
    || (repo === name && (workplaces?.repos ?? []).filter((x) => baseName(x.repo) === name).length === 1);
  const lines: StemAudit["lines"] = [];
  const run = a.running && mine(a.running.repo) && a.running.main === stem ? a.running : null;
  // the balls of the audit's run (src/suitemeter.ts): its clock and its machine, as every run says them
  const balls = run ? runsHere.audit : [];
  if (run) {
    const ball = balls.find((b) => b.station !== "done");
    const at = ball ? runMachine(ball) : null;
    lines.push({ look: "run", head: ball ? runSentence(ball) : `${CHECK_KIND.afterLand} ${RUN_STATE.running}`,
      more: [at ? `on ${at.name}` : "", run.covers.length ? `for ${run.covers.map(laneTail).join(", ")}` : ""].filter(Boolean).join(" · ") });
  }
  const waits = a.waiting.filter((x) => mine(x.repo) && x.main === stem);
  if (waits.length) lines.push({ look: "queue", head: `${waits.length} ${waits.length === 1 ? "land waits" : "lands wait"} for the next check after land`,
    more: waits.map((x) => laneTail(x.branch)).join(", ") });
  return lines.length ? { look: run ? "run" : "queue", lines, balls } : null;
}
// THE OPENED LANE'S CHECKS: "Weg nach <Ziel>" and the four points, and what is red in words — or "Noch
// keine Prüfung" where no check has a result (owner 2026-10-08: never a row of empty points)
function wayLine(w: WorkplaceRow, mine: MeterBall[] = []): HTMLElement {
  const line = el("div", "zd wl");
  line.dataset.for = w.path;
  const tx = el("span", "tx");
  const any = WAY.some(({ key, word }) => wayPoint(w, key, word, mine).cls !== "none");
  if (!any) {
    tx.appendChild(el("span", "w none", "No check yet"));
  } else {
    // "Weg nach main", as the diamond's note says it: "Prüfungen" is the block below, one word, one thing
    tx.append(el("span", "w", `Way to ${w.target.branch}`), laneWay(w, mine));
    const [first] = redStages(w);
    const c = first ? w.checks?.[first.key] : null;
    if (first && c) tx.appendChild(el("span", "wr", [`${first.word} red`, ...c.fails.slice(0, 1)].join(" · ")));
  }
  line.appendChild(tx);
  return line;
}
// THE TEST INSTANCE as a square in its worktree's row. "läuft" only where the server measured it up
// (process identity AND an answer over HTTP, docs/self-api.md, Testinstanz) — never from a pid.
type TiLook = { cls: string; state: string; word: string; expiresAt: number | null };
function tiLook(w: WorkplaceRow): TiLook {
  const inst = w.testinstanz?.instance as { expiresAt?: number | null } | undefined;
  const expiresAt = typeof inst?.expiresAt === "number" ? inst.expiresAt : null;
  if (w.template === "missing") return { cls: "tpl", state: "no-template", word: "no test instance template in this repo", expiresAt };
  const st = w.testinstanz?.state ?? null;
  if (st === "up") return { cls: "up", state: "up", word: `Test instance running${expiresAt ? ` until ${clockOf(expiresAt)}` : ""}`, expiresAt };
  if (st === "expired") return { cls: "exp", state: "expired", word: `Test instance expired${expiresAt ? ` ${agoEn(Date.now() - expiresAt)} ago` : ""}`, expiresAt };
  if (st === "not-running") return { cls: "off", state: "not-running", word: "no test instance", expiresAt };
  if (st === "http-failed" || st === "http-timeout") return { cls: "bad", state: st, word: "Test instance does not answer", expiresAt };
  return { cls: "unk", state: "unknown", word: "Test instance: unknown", expiresAt };
}
const tiRoute = (repo: string, w: WorkplaceRow, slot: number | null): string => slot !== null
  ? `/api/slots/${slot}/testinstanz`
  : `/api/worktrees/testinstanz?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(w.path)}`;
async function tiAct(repo: string, w: WorkplaceRow, slot: number | null, action: "up" | "down" | "open" | "refresh"): Promise<void> {
  if (tiBusy.has(w.path)) return;
  // a new tab has to be opened inside the click, or the browser blocks it; it gets its address once
  // the server has handed out the opening link (which carries the instance's own credential)
  const tab = action === "open" ? window.open("about:blank", "_blank") : null;
  if (tab) tab.opener = null; // the instance's page gets no handle on this one
  tiBusy.add(w.path);
  tiErr.delete(w.path);
  void renderBoard();
  try {
    const r = await post(tiRoute(repo, w, slot), action === "up" ? { action, ttlMin: 240 } : { action });
    const j = (await r.json().catch(() => ({}))) as { error?: string; refusal?: string; url?: string };
    if (!r.ok) throw new Error(j.error ?? j.refusal ?? `HTTP ${r.status}`);
    // a live lane's failed start is answered once its instance comes up (src/board.ts#startLiveSession)
    if (action === "up") liveErr.delete(w.path);
    if (action === "open") {
      if (!j.url) throw new Error("the server gave no link");
      if (tab) tab.location.href = j.url; else window.open(j.url, "_blank", "noopener");
    }
  } catch (error) {
    tab?.close();
    tiErr.set(w.path, error instanceof Error ? error.message : String(error));
  } finally {
    // the line stops saying "wird ausgeführt…" the moment the action has ended — not only once the
    // next read of the worktrees answers: until then its buttons stood disabled, and Stoppen right
    // after Öffnen was a dead click (K19, docs/messungen/2026-10-08-flake-register-audits.md)
    tiBusy.delete(w.path);
    void renderBoard();
    loadWorkplaces(true);
  }
}
// A MIRRORED WORKTREE (the Kern's snapshot row 05346b95: a test instance shows the machine's real
// worktrees READ-ONLY, each write door answers a named 409 there). The ONE place that reads the
// marker: it says false until that row lands and its field is known — no field is guessed here.
// Where it says true, the row is marked and its write buttons stand disabled.
function mirroredWorktree(_w: WorkplaceRow): boolean {
  return false;
}
// THE PORT beside the square (owner 14.10.: „[Zitat entfernt]“): the one
// the server measured for this instance, so a tab named „[Zitat entfernt]“ finds its row
function tiPortOf(w: WorkplaceRow): number | null {
  const port = (w.testinstanz?.instance as { port?: unknown } | undefined)?.port;
  return typeof port === "number" ? port : null;
}
function tiLine(repo: string, w: WorkplaceRow, slot: number | null, standOf: Map<string, WorkplaceStand>): HTMLElement {
  const look = tiLook(w);
  const line = el("div", "zd ti");
  line.dataset.for = w.path;
  const tx = el("span", `tx ${look.cls}`);
  // one sentence, whatever its state: "Testinstanz läuft bis 14:20" (owner 2026-10-08: the square
  // alone did not say what it stood for)
  tx.appendChild(el("span", `sq ${look.cls}`));
  const busy = tiBusy.has(w.path);
  const err = tiErr.get(w.path);
  const inst = w.testinstanz?.instance as { recordedSource?: { before?: { head?: string | null } | null } | null; port?: number | null } | undefined;
  const from = sha7(inst?.recordedSource?.before?.head ?? null);
  const port = tiPortOf(w);
  const word = busy ? "working…" : look.cls === "up" ? `running${look.expiresAt ? ` until ${clockOf(look.expiresAt)}` : ""}${port === null ? "" : ` · :${port}`}`
    : look.cls === "exp" ? "expired" : look.cls === "off" ? "off" : look.cls === "bad" ? "does not answer" : "unknown";
  tx.appendChild(el("span", "w", `Test instance ${word}`));
  // WHERE IT COMES FROM: the commit the copy was taken from, as recorded at the copy — not proof of
  // what runs in it (copyHead stays null on the wire, docs/self-api.md)
  const stand = standOf.get(`test-instance:${w.path}`);
  tx.title = [look.word,
    from ? `copied from ${from} — which state runs in the copy is not proven` : "state of the copy not proven",
    stand && stand.head === null ? "runs on: unknown" : ""].filter(Boolean).join(" · ");
  line.appendChild(tx);
  const acts = el("span", "r");
  const act = (label: string, title: string, action: "up" | "down" | "open" | "refresh", primary = false) => {
    const b = el("button", `rk-btn${primary ? " primary" : ""}`, label) as HTMLButtonElement;
    b.type = "button";
    b.title = title;
    b.disabled = busy;
    b.onclick = (e) => { e.stopPropagation(); void tiAct(repo, w, slot, action); };
    acts.appendChild(b);
  };
  if (look.cls === "up") {
    act("Open", `Open the test instance in a new tab${typeof inst?.port === "number" ? ` (port ${inst.port})` : ""}`, "open", true);
    act("Stop", "Stop the test instance — the copy no longer runs", "down");
  } else if (look.cls === "off") act("Start", "Start a test instance of this worktree — its own copy, its own port, for 4 h", "up", true);
  else if (look.cls === "exp") {
    act("Restart", "Restart the expired test instance — for 4 h", "up", true);
    act("Stop", "Clean up the expired test instance", "down");
  } else act("Read again", "Measure the test instance's state again — starts nothing", "refresh");
  line.appendChild(acts);
  if (err) line.appendChild(el("span", "err", err));
  return line;
}

// the lane controls of a worktree no session holds — moved here unchanged from the former
// "Lanes in ‹repo›" list: reopen, close (light confirm when clean, the read window when not), the
// shelve note, the review candidate and the owner's notepad. Only for the repo whose lane list the
// focused session read (`wts`), because only that list carries the risk facts close needs.
function worktreeControls(wts: WtInfo, w: WtRow): HTMLElement[] {
  const out: HTMLElement[] = [];
  const row = el("div", "rk-acts");
  const open = el("button", "rk-btn primary", w.review ? "Resume" : "Open") as HTMLButtonElement;
  open.title = w.review
    ? `Resume review candidate ${w.review.id} in a free slot — its tasks bind back, proofs from before shelving count as outdated`
    : "Open this worktree in a free slot and jump there";
  open.onclick = async (e) => {
    e.stopPropagation();
    if (laneReqBusy) return;
    laneReqBusy = true;
    try {
      const r = await post("/api/lanes", { repo: wts.repo, attach: w.path });
      const j = (await r.json().catch(() => ({}))) as { slot?: number; error?: string };
      if (!r.ok) { alert(j.error ?? "open failed"); return; }
      await refresh();
      loadWorkplaces(true);
      if (j.slot) showSlot(j.slot);
    } finally {
      laneReqBusy = false;
    }
  };
  row.appendChild(open);
  const close = el("button", "rk-btn del", "Close…") as HTMLButtonElement;
  close.title = w.empty
    ? "Close this worktree — clean, nothing is lost"
    : "This worktree has unsaved or unlanded work — shows first what would be lost";
  close.onclick = async (e) => {
    e.stopPropagation();
    if (w.empty) {
      const ok = await showRiskPreview(`Close lane ${w.branch}? — clean worktree, nothing to lose`, w, "close");
      if (!ok) return;
      const r = await post("/api/worktrees/remove", { repo: wts.repo, path: w.path });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        alert(j.error ?? "close failed");
      }
      loadWorkplaces(true);
      void renderBoard();
    } else {
      discardArm = { path: w.path, at: Date.now() }; // deliberate destruction gate (read-window below)
      void renderBoard();
    }
  };
  row.appendChild(close);
  out.push(row);
  // shelve note: this orphan was set aside with "what's left" — show it so resuming has context
  if (w.note != null) {
    const nrow = el("div", "sweepv shelved");
    nrow.appendChild(el("span", "sweepvbadge", w.review ? "⏸ review" : "⇲ shelved"));
    nrow.appendChild(el("span", "sweepvreason", w.note || "(no note)"));
    out.push(nrow);
  }
  // the review candidate's IDENTITY — a review record, not gate-green; the deadline removes nothing
  if (w.review) {
    const c = w.review;
    const crow = el("div", "sweepv shelved");
    crow.appendChild(el("span", "sweepvbadge", `candidate ${c.id}`));
    crow.appendChild(el("span", "sweepvreason",
      `head ${c.head.slice(0, 10)} · base ${c.base ?? "unknown"}${c.baseSha ? ` @ ${c.baseSha.slice(0, 10)}` : ""}`
      + ` · report ${c.reportId.slice(0, 8)} · tasks ${c.taskIds.join(", ")}`
      + (c.expired ? ` · deadline passed ${new Date(c.expiresAt).toLocaleString()} — decision due`
        : ` · deadline ${new Date(c.expiresAt).toLocaleString()}`)));
    out.push(crow);
  }
  out.push(notepadBlock(wts.repo, w));
  // the confirm panel is not a dialog: the consequences ARE the wait screen. The destructive button
  // unlocks only after the read window, counted from the first click and re-derived on every
  // repaint, so polling can't reset or skip the gate. Stale arms (>60s) auto-cancel.
  if (discardArm?.path === w.path) {
    if (Date.now() - discardArm.at > 60_000) { discardArm = null; return out; }
    const arm = discardArm;
    const box = el("div", "bdiscard");
    box.appendChild(el("div", "bdtitle", `discard ${w.branch}?`));
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
      loadWorkplaces(true);
      void renderBoard();
    };
    const btns = el("div", "bdbtns");
    btns.append(cancel, go);
    box.appendChild(btns);
    out.push(box);
  }
  return out;
}

// --- STANDS (card abe74821): "auf welchem Stand jedes Gerät, jede Instanz und jeder Worktree läuft
// und woher er kommt". One sentence per carrier: läuft auf <sha> · how far from its target · whether
// that distance touches its own code. Unknown stays unknown, with the reason as a sentence.
const SCOPE_WORD: Record<WorkplaceStand["codeScope"], string> = {
  server: "touches the server code", "helper-daemon": "touches the helper service", repository: "touches code",
};
function standSentence(st: WorkplaceStand): { text: (Node | string)[]; title: string; node: string; behindCode: boolean } {
  const parts: (Node | string)[] = [];
  const titles: string[] = [];
  const head = sha7(st.head);
  parts.push("runs on ");
  if (head) parts.push(el("span", "mono", head));
  else parts.push(el("span", "q", "unknown"));
  const t = st.target;
  let behindCode = false;
  if (head && t) {
    const ref = refShort(t.ref);
    const d = t.distance;
    if (!d) parts.push(` · distance to ${ref} unknown`);
    else if (d.ahead === 0 && d.behind === 0) parts.push(` · newest state of ${ref}`);
    else {
      parts.push(` · ${[d.behind ? `${d.behind}\u00a0behind` : "", d.ahead ? `${d.ahead}\u00a0ahead of` : ""].filter(Boolean).join(", ")} ${ref}`);
      if (d.behind) {
        if (t.codeBehind === true) { parts.push(" · "); parts.push(el("span", "cb", SCOPE_WORD[st.codeScope])); behindCode = true; }
        else if (t.codeBehind === false) parts.push(" · its own code is current");
        else parts.push(" · whether its own code is touched: unknown");
      }
    }
    if (t.mergeBase) titles.push(`branched off ${ref} at ${sha7(t.mergeBase)}`);
  }
  if (!head) {
    if (st.basis === "link-only") parts.push(" · this server does not read its repos");
    else if (st.basis === "checkout-unproven") {
      if (st.reportedCheckout) { parts.push(" · Checkout "); parts.push(el("span", "mono", sha7(st.reportedCheckout.head) ?? "")); }
      titles.push("the instance reports only its checkout, not the state of its running process");
    } else if (st.basis === "copy-unproven") titles.push("a test copy reports no proven state");
    else if (st.basis === "heartbeat") {
      // a helper without a stand still says when it last spoke at all: weeks of silence are the fact
      parts.push(st.observedAt ? ` · last reported ${agoEn(Date.now() - st.observedAt)} ago` : " · never reported");
      titles.push("the helper has not reported a state yet");
    }
  }
  if (head && st.basis === "heartbeat" && st.observedAt) titles.push(`last reported ${agoEn(Date.now() - st.observedAt)} ago — a last report, no proof it can be reached now`);
  if (st.update) titles.push(`Update: ${st.update.state}${st.update.mainSha ? ` to ${sha7(st.update.mainSha)}` : ""}`);
  const node = st.kind === "live-server" ? (behindCode ? "wait" : "live") : head ? "" : "leer";
  return { text: parts, title: titles.join(" · "), node, behindCode };
}
// THE TEST INSTANCE'S OWN ROW, in the machine group: the same words the band above the app paints
// (src/protocol.ts#instanceBandText, branch included), so both sights of one fact cannot drift.
// THE STAND AS A SENTENCE FOR PEOPLE (owner 2026-10-08: „[Zitat entfernt]“
// ): what the carrier's stand means for the reader. The chain
// itself — commit, distance, which code — stays standSentence and opens behind the row's tap.
function standSay(st: WorkplaceStand): string {
  const t = st.target, d = t?.distance;
  const server = st.kind === "live-server";
  if (!sha7(st.head)) {
    // "verlinkt" already stands beside the name (rolesOf) — the sentence says only what follows
    if (st.basis === "link-only") return "This server does not read its repos.";
    if (st.basis === "heartbeat") return st.observedAt ? `Reports no state, last heard ${agoEn(Date.now() - st.observedAt)} ago.` : "Has never reported.";
    return "Its state is not proven.";
  }
  if (!t || !d) return server ? "Running." : "Ready.";
  if (!d.behind) return server ? "Running the newest state." : "Ready, on the newest state.";
  if (t.codeBehind === true) return server ? "Running older server code." : "Ready, but its code is older than main.";
  if (t.codeBehind === false) return server ? "Running, the server code is current." : "Ready, its code is current.";
  return server ? "Running an older state." : "Ready, on an older state.";
}
// A MACHINE THAT HAS BEEN SILENT FOR DAYS is not news (owner 2026-10-08, „[Zitat entfernt]“
//  beside the active ones): a helper whose every carrier last spoke more than
// three days ago — or never — moves behind one quiet row at the end. A link carries no clock and
// stays where it is: it claims nothing to go stale.
const MACHINE_STILL_MS = 3 * 24 * 3600_000;
// THE DEVICES FOR THE SIDEBAR'S HEAD (owner 2026-10-08: „[Zitat entfernt]“
// 
// ): one sign per machine — the same glyph and the same state tone as its row under Geräte,
// read from the same stands. This machine first, the ones that answer next, the still ones last.
// null until the Arbeitsorte were read once. The read is started here only while Info is open (or
// when there was none yet): every client asks this on every poll, and every read of the Arbeitsorte
// observes all repos afresh — with Info closed the chip keeps the last reading (review 2026-10-08).
export type MachineSign = { glyph: IconName; tone: MachineState["tone"]; name: string; word: string };
export function machineSigns(): MachineSign[] | null {
  if (boardOpen || !workplaces) loadWorkplaces();
  const wp = workplaces;
  if (!wp) return null;
  const machines = machinesOf(wp.stands ?? []);
  const hereKey = instanceName ? machineKey(instanceName) : null;
  if (hereKey) machines.delete(hereKey);
  const due = !instanceSource && deployGapInfo?.codeBehind === true;
  const signs: MachineSign[] = [{ glyph: KIND_HERE.glyph, tone: due ? "wait" : "live", name: instanceName ?? "Dieser Rechner", word: due ? "Neustart fällig" : "läuft" }];
  const order: Record<MachineState["tone"], number> = { live: 0, wait: 1, link: 2, off: 3, still: 4 };
  const rest = [...machines].map(([key, list]) => {
    const st = machineState(list);
    return { glyph: machineKind(list).glyph, tone: st.tone, name: list[0]?.name ?? key, word: st.word };
  });
  return [...signs, ...rest.sort((a, b) => order[a.tone] - order[b.tone])];
}
function machineStill(list: WorkplaceStand[]): boolean {
  if (!list.length || list.some((st) => st.kind === "linked-instance")) return false;
  const heard = Math.max(...list.map((st) => st.observedAt ?? 0));
  return !heard || Date.now() - heard > MACHINE_STILL_MS;
}
let machinesLegendOpen = false;
// an instance without a word is a link to another Fleet: this server does not measure it, so it says
// nothing about it — the legend's last line says so, without a chip
const MACHINE_LEGEND: [MachineState["tone"] | null, string, string][] = [
  ["live", "online", "The device is there: this computer, or a helper that reported a moment ago and can take check runs."],
  ["live", "here", "The instance this page comes from."],
  ["wait", "restart due", "The server runs older code than its checkout — restart it, then the current state runs."],
  ["off", "offline", "A helper that is not reporting now — it takes no check runs. A test instance has no helpers."],
  ["still", "quiet", "No report for more than three days."],
  [null, "no word", "A linked Fleet on another computer. This server does not measure it; the name at the top left switches to it."],
];
function machinesLegend(): HTMLElement {
  const box = el("div", "rklegend");
  for (const [tone, word, text] of MACHINE_LEGEND) {
    const line = el("div", "lgl");
    const chip = el("span", "zs");
    if (tone) { line.dataset.tone = tone; chip.append(el("span", "zsd"), word); }
    else chip.append(el("span", "q", word));
    line.append(chip, el("span", "lgt", text));
    box.appendChild(line);
  }
  return box;
}
// WHERE YOU ARE (owner 2026-10-09 in the test instance: „[Zitat entfernt]“
// 
// ): the server this page comes from carries the mark "hier" — the test
// instance's row here, the Live row on the live server — and each kind keeps one sign: the test
// instance the green square its lane line draws, the Live-Server its glyph. The mark is drawn by CSS
// from data-hier, so the row's words stay what they say.
const HERE_MARK = "here";
// ONE WORD WITH ITS STATE (owner 2026-10-09: „[Zitat entfernt]“
// ; the same evening: „[Zitat entfernt]“): an instance's chip says "hier" and nothing more —
// it answers this page, so it runs — and a due restart says so before it ("Neustart fällig · hier")
function markHere(row: HTMLElement): void {
  row.dataset.hier = HERE_MARK;
}
const HERE_STATE: MachineState = { tone: "live", word: HERE_MARK, title: "This page comes from this instance" };
// EVERY DEVICE GETS ITS INSTANCES (owner 2026-10-09: „[Zitat entfernt]“
// ; „[Zitat entfernt]“): an instance row
// and its tap lines stand one rail in under their device, a step smaller
function asInstance(rows: HTMLElement[]): HTMLElement[] {
  for (const r of rows) r.classList.add("inst");
  return rows;
}
function testInstanceStandRows(source: InstanceSource): HTMLElement[] {
  // EVERY MACHINE ROW BUILT ALIKE (owner 2026-10-09 in the test instance: „[Zitat entfernt]“
  // 
  // ): its sign, its name with the port, and at the right end the mark "hier", the state as dot
  // and word and the chevron — the machine rows' grammar (#machineRow); a tap opens the stand it shows.
  // It runs: it is answering this page. Its sign is the test instance's square, filled (owner
  // 2026-10-08: a hollow ring read as "off").
  const port = location.port;
  const band = instanceBandText(source, (ms) => new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
  const rows = machineRow("testinstanz", "Test instance", { glyph: "laptop", word: port ? `Port\u00a0${port}` : "" }, [],
    { ...HERE_STATE, title: "This page comes from this test instance" }, null,
    [{ label: "State", text: band.text, st: null }, { label: "Note", text: band.title, st: null }],
    "Here: this page comes from this test instance, not from the live server");
  const [row] = rows;
  row.dataset.glyph = "testinstanz";
  markHere(row);
  row.querySelector(":scope > .fx")?.replaceChildren(el("span", "sq up"));
  return asInstance(rows);
}
function machineHead(kind: MachineKind, name: string, sub: string, state: MachineState, title: string): HTMLElement {
  const row = el("div", "zr mach");
  row.dataset.tone = state.tone;
  row.dataset.glyph = kind.glyph;
  const fx = el("span", "fx");
  fx.appendChild(icon(kind.glyph));
  row.appendChild(fx);
  const nm = el("span", "nm", name);
  if (sub) nm.appendChild(el("span", "cnt", sub));
  row.appendChild(nm);
  row.appendChild(stateChip(state));
  row.title = title;
  return row;
}

// WHAT KIND OF MACHINE, AND HOW IT IS (owner 2026-10-08, at the test instance: „[Zitat entfernt]“
// 
// ). The kind is a glyph and a word beside the name: this computer, a helper (it reports as
// one), the live server (the wire marks the way back to it, server.ts#instanceChipLinks), or a fleet
// that is only linked. The state stands at the row's right end as a dot AND a word — never the
// colour alone: läuft (--q-live: it answers, or a helper reports — it moves on its own), Neustart fällig (--q-wait, it
// waits for you), verlinkt (ink: a link, nothing measured), nicht angemeldet (an amber ring: not
// measured now), still (faint, days without a word). Nothing here is a new reading: every state is
// the stands' observedAt against the server's own online window (deviceOnlineMs), or a link.
type MachineKind = { glyph: IconName; word: string };
type MachineState = { tone: "live" | "wait" | "link" | "off" | "still"; word: string; title: string };
const KIND_HERE: MachineKind = { glyph: "laptop", word: "this computer" };
const KIND_HELPER: MachineKind = { glyph: "server", word: "helper" };
function machineKind(list: WorkplaceStand[]): MachineKind {
  if (list.some((st) => st.kind === "helper-daemon" || st.kind === "helper-instance")) return KIND_HELPER;
  if (list.some((st) => st.kind === "linked-instance" && switchLinks.some((l) => l.kind === "live" && l.name === st.name)))
    return { glyph: "live", word: "Live server" };
  return { glyph: "link", word: "Fleet instance" };
}
function machineState(list: WorkplaceStand[]): MachineState {
  const helper = list.filter((st) => st.kind === "helper-daemon" || st.kind === "helper-instance");
  if (!helper.length) return { tone: "link", word: "verlinkt", title: "A link to this Fleet — this server does not measure it" };
  const heard = Math.max(...helper.map((st) => st.observedAt ?? 0));
  const ago = heard ? `last heard ${agoEn(Date.now() - heard)} ago` : "never reported";
  if (machineStill(list)) return { tone: "still", word: "still", title: `No report for more than three days — ${ago}` };
  // "läuft" like every machine that runs (owner 2026-10-09: „[Zitat entfernt]“)
  if (deviceOnlineMs !== null && heard && Date.now() - heard < deviceOnlineMs) return { tone: "live", word: "läuft", title: `Reports as a helper regularly — ${ago}` };
  return { tone: "off", word: "nicht angemeldet", title: `Not reporting now — ${ago}` };
}
// A DEVICE'S OWN WORD (owner 2026-10-09: „[Zitat entfernt]“
// ): a device is online or offline — "läuft" is said of a server; a machine
// known only by a link has nothing measured and no chip. The sidebar's signs keep machineState's words.
// this tab says them in English (owner 18.10. 23:4x); machineState keeps the sidebar's German words
const DEVICE_WORD: Partial<Record<MachineState["tone"], string>> = { live: "online", off: "offline", still: "quiet" };
function deviceState(list: WorkplaceStand[]): MachineState | null {
  const st = machineState(list);
  return st.tone === "link" ? null : { ...st, word: DEVICE_WORD[st.tone] ?? st.word };
}
function stateChip(state: MachineState): HTMLElement {
  const chip = el("span", "zs");
  chip.appendChild(el("span", "zsd"));
  chip.appendChild(document.createTextNode(state.word));
  chip.title = state.title;
  return chip;
}

// --- ONE ROW PER MACHINE (owner 2026-10-07). The stands arrive per CARRIER — a helper's daemon, its
// instance, a link to a Fleet — and a machine is the name they report under, so they group by that
// name (case and spaces aside). The row: the name, the roles the carriers give it, the sentence of
// its first carrier; a tap opens every other carrier's sentence and the reasons the hover holds
// (a phone has no hover). Order: the helper's daemon, its instance, then the link.
const machineKey = (name: string): string => name.trim().toLowerCase();
const CARRIER_ORDER: WorkplaceStand["kind"][] = ["live-server", "helper-daemon", "helper-instance", "linked-instance"];
function machinesOf(stands: WorkplaceStand[]): Map<string, WorkplaceStand[]> {
  const out = new Map<string, WorkplaceStand[]>();
  stands.forEach((st, i) => {
    if (st.kind !== "helper-daemon" && st.kind !== "helper-instance" && st.kind !== "linked-instance") return;
    // a carrier without a name is a machine of its own: nothing says which other one it is
    const key = st.name ? machineKey(st.name) : `\0${st.kind}${i}`;
    out.set(key, [...(out.get(key) ?? []), st]);
  });
  for (const list of out.values()) list.sort((a, b) => CARRIER_ORDER.indexOf(a.kind) - CARRIER_ORDER.indexOf(b.kind));
  return out;
}
// a link is an instance row of its own under the device now (#asInstance), no role beside its name
function rolesOf(list: WorkplaceStand[]): string[] {
  return list.some((st) => st.kind === "helper-daemon" || st.kind === "helper-instance") ? ["helper"] : [];
}
function carrierWord(st: WorkplaceStand): string {
  return st.kind === "helper-daemon" ? "Helper service" : st.kind === "helper-instance" ? "Instance"
    : st.kind === "linked-instance" ? "Fleet instance" : "Live";
}
type MachineLead = { label: string | null; st: WorkplaceStand; due?: boolean; dueTitle?: string }
  | { label: string; text: string; node: string; kind: string };
type MachineFact = { label: string; text: string | null; st: WorkplaceStand | null };
// state null: nothing this server measures — no chip (a linked instance, a device known only by its link)
function machineRow(key: string, name: string, kind: MachineKind, roles: string[], state: MachineState | null, lead: MachineLead | null, facts: MachineFact[], about: string): HTMLElement[] {
  const row = el("div", "zr mach");
  if (state) row.dataset.tone = state.tone;
  row.dataset.glyph = kind.glyph;
  const fx = el("span", "fx");
  fx.appendChild(icon(kind.glyph));
  row.appendChild(fx);
  // the kind's word first, then any other role a carrier gives — never the state's word twice
  const words = [kind.word, ...roles.filter((r) => r !== kind.word && r !== state?.word)].filter(Boolean);
  const nm = el("span", "nm", name);
  nm.appendChild(el("span", "cnt", words.join(" · ")));
  row.appendChild(nm);
  if (state) row.appendChild(stateChip(state));
  const titles = [[name, ...words, state?.word ?? ""].filter(Boolean).join(" · ")];
  // what a tap opens: the lead's own reasons, then every other carrier in its own words
  const lines: (Node | string)[][] = [];
  // a link measures nothing, so its sentence ("Ihre Repos liest dieser Server nicht") is no line
  // of its own: the chip says verlinkt, the sentence stays behind the tap and in the title
  const quiet = lead !== null && "st" in lead && lead.st.basis === "link-only";
  if (lead) {
    if (!quiet) row.classList.add("one");
    const say = el("span", "st");
    if ("st" in lead) {
      const s = standSentence(lead.st);
      row.dataset.kind = lead.st.kind;
      // the row says what it means; a due restart leads with what to do — the chain opens on a tap
      // ("Neustart fällig" is the chip's word now — the sentence says why, not the same twice)
      if (lead.due) say.append("Running older server code.");
      else say.append(standSay(lead.st));
      if (lead.due) { row.classList.add("due"); titles.push(lead.dueTitle ?? ""); }
      lines.push([el("b", "", lead.label && !lead.due ? lead.label : carrierWord(lead.st)), " · ", ...s.text]);
      if (s.title) { lines.push([s.title]); titles.push(s.title); }
    } else {
      row.dataset.kind = lead.kind;
      say.append(el("b", "", lead.label), ` · ${lead.text}`);
    }
    if (!quiet) row.appendChild(say);
    titles.splice(1, 0, say.textContent ?? "");
  }
  for (const f of facts) {
    const s = f.st ? standSentence(f.st) : null;
    lines.push([el("b", "", f.label), " · ", ...(s ? s.text : [f.text ?? ""]), ...(s?.title ? [` — ${s.title}`] : [])]);
  }
  const id = `mach:${key}`;
  const open = rankeOpen === id && lines.length > 0;
  row.dataset.machine = name;
  row.title = [...titles, about].filter(Boolean).join(" — ");
  if (!lines.length) return [row];
  const fc = el("span", "fc");
  fc.appendChild(icon("chevron"));
  row.appendChild(fc);
  if (open) row.classList.add("open");
  rowTarget(row, () => { rankeOpen = open ? null : id; void renderBoard(); });
  row.setAttribute("aria-expanded", String(open));
  if (!open) return [row];
  return [row, ...lines.map((parts) => {
    const line = el("div", "zd mx");
    line.dataset.for = id;
    const tx = el("span", "tx");
    tx.append(...parts);
    line.appendChild(tx);
    return line;
  })];
}

// the session a worktree's row names, while that slot still holds the same occupant
function workSlot(w: WorkplaceRow): SlotInfo | undefined {
  if (!w.session) return undefined;
  const s = fleet[w.session.slot - 1];
  return s?.cwd && (s.openedAt === undefined || s.openedAt === w.session.openedAt) ? s : undefined;
}

// a row that acts on a click is a target for the keyboard too: Tab reaches it, Enter or Space act
function rowTarget(row: HTMLElement, act: () => void): void {
  row.tabIndex = 0;
  row.setAttribute("role", "button");
  row.onclick = act;
  row.onkeydown = (e) => {
    if (e.target !== row || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    act();
  };
}

export function arbeitsorteSection(focusSlot: number | null, wts: WtInfo | null): HTMLElement {
  loadWorkplaces();
  // NO HEAD OF ITS OWN (owner 2026-10-09: „[Zitat entfernt]“
  // ): its blocks Projekte, Prüfungen and Geräte each carry their own head
  const sec = el("div", "bsec ranke");
  const wp = workplaces;
  if (!wp) {
    sec.appendChild(el("div", "bempty", workplacesErr ? `The workplaces could not be read — ${workplacesErr}.` : "reading the workplaces…"));
    return sec;
  }
  if (workplacesErr) sec.appendChild(el("div", "bstale", `As of ${clockOf(wp.measuredAt)} — reading again failed: ${workplacesErr}`));
  const focus = focusSlot ? fleet[focusSlot - 1] : undefined;
  // THREE BLOCKS (owner 2026-10-08, round 2): the projects with their lanes, the checks that run,
  // the machines — each under its own small head, so the eye finds a kind of thing, not a row. The
  // machine rows are built first (the here-row needs the stands) and placed last.
  const block = (key: string, title: string): HTMLElement => {
    const b = el("div", `rkblock rk-${key}`);
    const h = el("div", "rkbh");
    h.appendChild(el("span", "rkbt", title));
    b.appendChild(h);
    return b;
  };
  const checks = block("runs", SECTION.checks), devices = block("dev", SECTION.devices);
  // the checks block's head opens and closes it (#runsSummary)
  const runsHead = checks.firstElementChild as HTMLElement;
  runsHead.classList.add("fold");
  runsHead.appendChild(icon("chevron"));
  runsHead.title = boardFolds.has(RUNS_FOLD) ? "Click folds the checks into one line" : RUNS_OPEN_HINT;
  rowTarget(runsHead, toggleRuns);
  runsHead.setAttribute("aria-expanded", String(boardFolds.has(RUNS_FOLD)));
  readRunsHere();
  const standOf = new Map<string, WorkplaceStand>();
  for (const st of wp.stands ?? []) if (st.path) standOf.set(`${st.kind}:${st.path}`, st);

  // 1 — THIS MACHINE: its running server, then its repos. EVERY MACHINE ONCE (owner 2026-10-07,
  // „[Zitat entfernt]“): a machine is its NAME, so a link or a helper that carries
  // this server's own name is this row and not a second one under the same name.
  const machines = machinesOf(wp.stands ?? []);
  const hereKey = instanceName ? machineKey(instanceName) : null;
  const hereOwn = (hereKey ? machines.get(hereKey) : undefined) ?? [];
  if (hereKey) machines.delete(hereKey);
  const here = el("div", "grp");
  const hereName = instanceName ?? "This computer";
  // WHICH MACHINE A RUN IS ON: by the name its `where` carries — this machine ("this machine", or the
  // instance's own name) or a machine Geräte draws under that name; anything else names none
  runMachine = (b) => {
    if (b.where === "this machine" || (hereKey !== null && machineKey(b.where) === hereKey)) return { glyph: KIND_HERE.glyph, name: hereName };
    const list = machines.get(machineKey(b.where));
    return list ? { glyph: machineKind(list).glyph, name: list[0]?.name ?? b.where } : null;
  };
  const hereRoles = rolesOf(hereOwn);
  const hereRuns: MachineState = { tone: "live", word: "online", title: "The computer the server of this page runs on" };
  const hereFacts = hereOwn.map((st) => st.kind === "linked-instance"
    ? { label: "Fleet instance", text: "linked — that is this server", st: null } : { label: carrierWord(st), text: null, st });
  const lives = (wp.stands ?? []).filter((st) => st.kind === "live-server");
  if (instanceSource) {
    // A TEST INSTANCE DOES NOT CALL ITSELF LIVE (owner, 2026-10-06): the copy has no .git, so its
    // boot head is unreadable and its row would read „[Zitat entfernt]“. It names itself
    // and carries the stand measured BEFORE the copy (instance.source), in the band's own words.
    here.append(...machineRow("here", hereName, KIND_HERE, hereRoles, hereRuns, null, hereFacts,
      "The computer this Fleet server runs on — under it every repo it reads"));
    // THE LIVE-SERVER BESIDE THE TEST INSTANCE (owner 2026-10-09 in the test instance: „[Zitat entfernt]“
    // ): an
    // instance's way back is the live fleet of THIS machine (testinstanz.sh#ti_live_url), so that link
    // stands under this machine above the instance's own row, and not as a machine of its own
    const live = [...machines].find(([, list]) => list.every((st) => st.kind === "linked-instance") && machineKind(list).glyph === "live");
    if (live) {
      const [key, list] = live;
      machines.delete(key);
      const link = switchLinks.find((l) => l.kind === "live" && list.some((st) => st.name === l.name));
      let port = "";
      try { port = link ? new URL(link.url).port : ""; } catch { /* no port said, none shown */ }
      here.append(...asInstance(machineRow(key, "Live server", { glyph: "live", word: port ? `Port\u00a0${port}` : "" }, [], null,
        { label: null, st: list[0] }, list.slice(1).map((st) => ({ label: carrierWord(st), text: null, st })),
        "The real Fleet on this computer — this test instance does not measure it; the name at the top left switches to it")));
    }
    here.append(...testInstanceStandRows(instanceSource));
  } else {
    // "deploy due" lives HERE now (§3, I3): it is the same statement as the Live row — does the running
    // server carry the newest code — so a due restart renames the row in the wait colour (G0.2: amber
    // means unmeasured, a due restart waits on you), and an outdated page bundle adds its own line
    const restartDue = deployGapInfo?.codeBehind === true;
    const [live, ...moreLives] = lives;
    let lead: MachineLead | null = null;
    if (live) {
      const due = restartDue || live.target?.codeBehind === true;
      lead = { label: due ? "Restart due" : "Live", st: live, due,
        dueTitle: "The running server booted from an older commit, and the difference touches server code: restart it, then this state runs." };
    } else if (deployGapInfo) {
      // an older server without stands: the deploy gap alone, said as plainly
      const n = deployGapInfo.behindCount;
      lead = { label: "Live", text: `runs on ${sha7(deployGapInfo.bootHead) ?? "unknown"}${n === null ? "" : n === 0 ? " · newest state" : ` · ${n}\u00a0behind`}`,
        node: deployGapInfo.codeBehind ? "wait" : "live", kind: "live-server" };
    }
    const due = restartDue || (lead !== null && "st" in lead && lead.due === true);
    here.append(...machineRow("here", hereName, KIND_HERE, hereRoles, hereRuns, null, hereFacts,
      "The computer this Fleet server runs on — under it every repo it reads"));
    // THE LIVE-SERVER UNDER ITS MACHINE, as in a test instance: the page comes from it, so its chip
    // says "hier" — and a due restart before it, in the wait colour (it waits on you)
    if (lead) {
      const port = location.port;
      const rows = asInstance(machineRow("live", "Live server", { glyph: "live", word: port ? `Port\u00a0${port}` : "" }, [],
        due ? { tone: "wait", word: `restart due · ${HERE_MARK}`, title: "The server runs older code — restart it, then this state runs" } : HERE_STATE, lead,
        moreLives.map((st) => ({ label: "Live", text: null, st })),
        "The Fleet on this computer this page comes from"));
      markHere(rows[0]);
      rows[0].title = `Here: this page comes from the live server — ${rows[0].title}`;
      here.append(...rows);
    }
    if (bundleStaleInfo?.stale === true) {
      const row = el("div", "zr stand due");
      row.dataset.kind = "bundle";
      row.appendChild(el("span", "nd wait"));
      const nm = el("span", "nm");
      nm.append(el("b", "", "Rebuild the page"), " — the browser shows an older state.");
      row.appendChild(nm);
      row.title = "The browser shows an older state — run `bun run build` in the terminal, then it is current (public/*.js are build artefacts).";
      here.appendChild(row);
    }
  }
  devices.appendChild(here);

  // ONLY THE SELECTED SESSION'S REPO (owner Z131, 18.10.: „[Zitat entfernt]“
  // ): the session
  // the left bar marks (panes[focused]) shows its repo and nothing beside it; no session, or one outside every repo this
  // server reads, shows no structure. THE GIT STRUCTURE IS THE PROJECTS (owner Z83; src/gitstruktur.ts): its heads,
  // sessions and checks, and what the Projekte block could do in the menus of its heads (Bestandsaufnahme 3db17b9a)
  const focusR = focus ? sessionRepo(focus, wp.repos) : undefined;
  const git = el("div", "rkblock rk-git");
  if (focusR) git.appendChild(gitBlock(focusR, wts, standOf));
  // the checks are drawn after the projects: what found its lane is not said twice
  checks.appendChild(runRows(focusSlot === null));

  // 2 — THE OTHER MACHINES: helpers by their fleet name, then each linked instance — one row each,
  // whatever reports under the name
  const helpers = new Map([...machines].filter(([, list]) => list.some((st) => st.kind !== "linked-instance")));
  // machines without a name are told apart by a number, never folded into one
  const nameless = (st: WorkplaceStand) => (st.kind === "linked-instance" ? "linked Fleet" : "helper without a name");
  const namelessCount = new Map<string, number>(), namelessSeen = new Map<string, number>();
  for (const [, [first]] of machines) if (!first.name) namelessCount.set(nameless(first), (namelessCount.get(nameless(first)) ?? 0) + 1);
  const still = [...machines].filter(([, list]) => machineStill(list));
  const drawMachine = (key: string, list: WorkplaceStand[], into: HTMLElement) => {
    const [first] = list;
    const g = el("div", "grp");
    let name = first.name;
    if (!name) {
      const n = (namelessSeen.get(nameless(first)) ?? 0) + 1;
      namelessSeen.set(nameless(first), n);
      name = (namelessCount.get(nameless(first)) ?? 0) > 1 ? `${nameless(first)} ${n}` : nameless(first);
    }
    // THE DEVICE, THEN ITS INSTANCES (#asInstance): what reports as a helper is the device's own row and
    // its state; each link to a Fleet on it stands one rail in under it, with no state of its own
    const own = list.filter((st) => st.kind !== "linked-instance"), links = list.filter((st) => st.kind === "linked-instance");
    const [lead, ...rest] = own;
    g.append(...machineRow(key, name, own.length ? KIND_HELPER : { glyph: KIND_HELPER.glyph, word: "" }, rolesOf(own), deviceState(list),
      lead ? { label: carrierWord(lead), st: lead } : null, rest.map((st) => ({ label: carrierWord(st), text: null, st })),
      own.length ? "A helper device of this Fleet — its state is its last report" : "A device this Fleet knows only by a link"));
    links.forEach((st, i) => {
      const link = switchLinks.find((l) => l.name === st.name);
      let port = "";
      try { port = link ? new URL(link.url).port : ""; } catch { /* no port said, none shown */ }
      const live = link?.kind === "live";
      g.append(...asInstance(machineRow(`${key}:${i}`, live ? "Live server" : "Fleet instance", { glyph: live ? "live" : "link", word: port ? `Port\u00a0${port}` : "" },
        [], null, { label: null, st }, [], "A linked Fleet instance — only a link, no connection; the name at the top left switches to it")));
    });
    into.appendChild(g);
  };
  // ALL MACHINES STAND TOGETHER (owner 2026-10-08, round 2: „[Zitat entfernt]“) — the silent
  // ones too, last and faint (their chip says still), no fold of their own
  for (const [key, list] of machines) if (!machineStill(list)) drawMachine(key, list, devices);
  for (const [key, list] of still) drawMachine(key, list, devices);
  if (instanceSource && !helpers.size) {
    // HELPER DEVICES NEVER VANISH SILENTLY (owner, 2026-10-06): a snapshot carries none (their data
    // is stripped at the copy), so the group says so instead of being absent. The live fleet keeps
    // its old picture: helpers stand when they report, and a fleet truly without any says nothing.
    // Offline like every silent device, and WHY in the row's own words (UI-MAIN d00a5a9d: "nicht
    // angemeldet" is another act for the owner than „[Zitat entfernt]“, and a phone has no hover)
    const g = el("div", "grp");
    g.appendChild(machineHead(KIND_HELPER, "Helper", "",
      { tone: "off", word: "offline · not signed in", title: "A test instance carries no helper devices over" },
      "Helper devices belong to the real Fleet — a test instance's copy does not carry them over, so this instance reports none."));
    devices.appendChild(g);
  }
  // …and what the states mean, on demand: a glyph in the block's head opens one line per state
  const why = el("button", `rk-btn quiet ib${machinesLegendOpen ? " on" : ""}`) as HTMLButtonElement;
  why.type = "button";
  why.appendChild(icon("info"));
  why.title = machinesLegendOpen ? "Close the explanation" : "What the device states mean";
  why.setAttribute("aria-label", "What the device states mean");
  why.setAttribute("aria-expanded", String(machinesLegendOpen));
  why.onclick = () => { machinesLegendOpen = !machinesLegendOpen; void renderBoard(); };
  devices.firstElementChild!.appendChild(why);
  if (machinesLegendOpen) devices.appendChild(machinesLegend());
  sec.append(...(focusR ? [git] : []), checks, devices);
  return sec;
}

// A PROJECT'S HEAD (owner 2026-10-08, round 2: „[Zitat entfernt]“): its state as dot and
// word — waiting for you first, then working, then a land check that runs, else quiet — and, in the hover of its name,
// where it comes from: the remotes as the local refs know them (no fetch). No tag for them in the head (owner Z135, 19.10.:
// „[Zitat entfernt]“) — main's menu says it in words
function projectHead(R: WorkplaceRepo, standOf: Map<string, WorkplaceStand>): { state: MachineState; facts: string[] } {
  const rows = R.worktrees ?? [];
  const lanes = rows.filter((w) => !w.primary);
  const active = lanes.filter((w) => { const s = workSlot(w); return s && slotWorks(s.id); }).length;
  const waiting = lanes.filter((w) => workSlot(w)?.awaiting === "owner").length;
  const checking = rows.some((w) => w.checks.gate?.state === "running" || w.checks.gate?.state === "waiting");
  const state: MachineState = waiting ? { tone: "wait", word: `${waiting} waiting for you`, title: "Lanes of this project wait for your answer" }
    : active ? { tone: "live", word: `${active} working`, title: "Sessions in lanes of this project are working right now" }
    : checking ? { tone: "live", word: "being checked", title: "A land check of this project runs or waits" }
    : { tone: "still", word: "quiet", title: "No lane works, none waits for you" };
  const facts = [`${lanes.length} ${lanes.length === 1 ? "branch" : "branches"}`];
  const primary = rows.find((w) => w.primary);
  const pst = primary ? standOf.get(`worktree:${primary.path}`) : undefined;
  if (pst?.remote === "none") facts.push("no remote — a state of its own, not an error");
  else if (Array.isArray(pst?.remote) && pst.remote.length) {
    facts.push(...pst.remote.map((r) => `${r.ref === null ? "unknown" : refShort(r.ref)}: ${r.head ? sha7(r.head) : "no local image"}`
      + (r.distance ? ` · ${r.distance.ahead} ahead, ${r.distance.behind} behind` : "")
      + (r.refAgeMs !== null ? ` · last synced ${agoEn(r.refAgeMs)} ago` : "")), "— from the local images, without the network");
  }
  return { state, facts };
}
// where main stands against its first remote, for main's menu: only where the copies differ, in words, as the local refs
// last saw it
function remoteLine(R: WorkplaceRepo, standOf: Map<string, WorkplaceStand>): string | null {
  const primary = (R.worktrees ?? []).find((w) => w.primary);
  const pst = primary ? standOf.get(`worktree:${primary.path}`) : undefined;
  const r0 = Array.isArray(pst?.remote) ? pst.remote[0] : undefined, d = r0?.distance;
  if (!r0 || !d || !(d.ahead || d.behind)) return null;
  const name = r0.name ?? "the remote", n = (k: number) => `${k}\u00a0${k === 1 ? "commit" : "commits"}`;
  return [d.ahead ? `${n(d.ahead)} not on ${name} yet` : "", d.behind ? `${n(d.behind)} on ${name} not here` : ""].filter(Boolean).join(", ")
    + (r0.refAgeMs !== null ? ` (as of ${agoEn(r0.refAgeMs)} ago)` : "");
}

// ONE PROJECT AS ITS GIT STRUCTURE with what the Projekte block could do (owner Z83; src/gitstruktur.ts#headWords decides
// which head offers which word): the head with the project's state and „[Zitat entfernt]“, the menu of the selected head or diamond,
// and under the structure what must stay in sight — a live start on its way or failed, the fold of many quiet worktrees
function gitBlock(R: WorkplaceRepo, wts: WtInfo | null, standOf: Map<string, WorkplaceStand>): HTMLElement {
  const repaint = () => void renderBoard();
  const rows = R.worktrees ?? [];
  // MORE THAN 12 WORKTREES WITHOUT A SESSION wait behind one line, as they did in the Ranke
  const idle = rows.filter((w) => !w.primary && !workSlot(w) && !boardBranch(R.repo, w.branch));
  const folded = gsView.idle && idle.length > 12 && !rankeFoldOpen.has(R.repo) ? idle : [];
  const runsOf = (w: WorkplaceRow) => {
    const s = workSlot(w);
    return { mine: (w.branch ? runsHere.byBranch.get(w.branch) ?? [] : []).filter((b) => b.slot === null || b.slot === s?.id),
      ended: (w.branch ? runsHere.doneByBranch.get(w.branch) ?? [] : []).filter((b) => b.slot === null || b.slot === s?.id) };
  };
  const board = boardRepo(R.repo);
  const integration = board?.integration ?? "main";
  const audit = stemAudit(R, integration);
  const m = gitModel(folded.length ? { ...R, worktrees: rows.filter((w) => !folded.includes(w)) } : R, board, fleet, slotWorks,
    (x) => gsCard(x as SlotInfo), { live: isLiveLane, run: (w) => {
      const { mine, ended } = runsOf(w);
      const g = gateLook(w, mine, ended);
      return g === "run" ? "running" : g === "queue" ? "waiting" : null;
    }, hide: { landed: !gsView.landed, idle: !gsView.idle } });
  const head = projectHead(R, standOf);
  const add = el("button", "rk-btn quiet ib gsadd") as HTMLButtonElement;
  add.type = "button";
  add.appendChild(icon("plus"));
  add.title = "New session in this repo — a lane, a branch session or another role";
  add.setAttribute("aria-label", add.title);
  add.onclick = (e) => { e.stopPropagation(); openK15Entwurf({ repo: R.repo }); };
  const gear = el("button", `rk-btn quiet ib gsgear${gsSetOpen ? " on" : ""}`) as HTMLButtonElement;
  gear.type = "button";
  gear.appendChild(icon("gear"));
  gear.title = gsSetOpen ? "Close the settings of this view" : "Settings of this view: what it shows, how lanes land";
  gear.setAttribute("aria-label", "Settings of this view");
  gear.setAttribute("aria-expanded", String(gsSetOpen));
  gear.onclick = (e) => { e.stopPropagation(); gsSetOpen = !gsSetOpen; repaint(); };
  const sel = gsSel?.repo === R.repo ? gsSel : null;
  const panel = sel ? gsPanel(R, m, sel.key, sel.word, wts, standOf, audit, runsOf, repaint) : null;
  const drawn = sel ? `${R.repo}\n${sel.key}\n${sel.word ?? ""}` : "";
  const fresh = !panel || gsDrawn === drawn ? null : gsDrawn.startsWith(`${R.repo}\n${sel?.key}\n`) ? "step2" : "step1";
  if (sel) gsDrawn = drawn;
  const arriving = liveArriving(R.repo, rows);
  const below: HTMLElement[] = [];
  if (arriving) below.push(liveGhost(arriving));
  const repoErr = liveErr.get(R.repo);
  if (repoErr && !(sel?.word === "live")) below.push(Object.assign(el("div", "zd live-err"), { textContent: repoErr }));
  for (const w of rows) { const e = liveErrLine(w); if (e) below.push(e); }
  if (folded.length) {
    const f = el("button", "gsquiet zu") as HTMLButtonElement;
    f.type = "button";
    f.appendChild(icon("chevron"));
    f.appendChild(el("span", "", `${folded.length} worktrees without a session`));
    f.title = "Show the worktrees without a session";
    f.onclick = () => { rankeFoldOpen.add(R.repo); repaint(); };
    below.push(f);
  }
  for (const b of below) b.classList.add("gsbelow");
  const open = rankeRepos.get(R.repo) ?? true;
  // the state's dot in its tone, as the legend says it: a full green dot while lanes work, a ring when quiet
  const toned = el("span", "gstone");
  toned.dataset.tone = head.state.tone;
  toned.appendChild(stateChip(head.state));
  const box = gitStructure(m, {
    open, toggle: () => { rankeRepos.set(R.repo, !open); prefSet("fleet.ranke.repos", JSON.stringify(Object.fromEntries(rankeRepos))); repaint(); }, info: gsInfo, toggleInfo: () => { gsInfo = !gsInfo; repaint(); },
    side: [toned, gear, add], settings: gsSetOpen ? gsSettings(R.repo) : null,
    sel: sel?.key ?? null, select: (key) => { gsSel = key ? { repo: R.repo, key, word: null } : null; if (!key) gsDrawn = ""; repaint(); },
    jump: jumpTo, panel, fresh, below,
  });
  const fold = box.querySelector<HTMLElement>(".gsf");
  if (fold) fold.title = `${fold.title}\n${head.facts.join("\n")}`;
  return box;
}

// THE MENU of a selected head or diamond (owner Z86 „[Zitat entfernt]“): step 1 begins with the head's test
// instance — its state, port and Starten/Öffnen/Beenden — then at most three facts in one line, a lane's land form, and
// quiet words; a word acts at once or opens step 2 under it, built by the functions the Projekte block used
function gsPanel(R: WorkplaceRepo, m: GsModel, key: string, word: GsWord | null, wts: WtInfo | null, standOf: Map<string, WorkplaceStand>,
  audit: StemAudit | null, runsOf: (w: WorkplaceRow) => { mine: MeterBall[]; ended: MeterBall[] }, repaint: () => void): HTMLElement | null {
  const rk = rowOf(key), dia = key.startsWith("dia:");
  const rows = R.worktrees ?? [];
  const primary = rows.find((w) => w.primary);
  const isMain = rk === `main:${m.integration}`;
  const branch = isMain ? m.integration : rk.replace(/^(branch|lane):/, "");
  const item = m.items.find((i) => `${i.kind}:${i.branch}` === rk) ?? m.items.flatMap((i) => i.lanes).find((l) => `lane:${l.branch}` === rk);
  if (!isMain && !item) return null;
  const w = isMain ? primary : rows.find((x) => !x.primary && x.branch === branch) ?? (primary?.branch === branch ? primary : undefined);
  const bb = isMain ? undefined : boardBranch(R.repo, branch);
  const slot = item?.sessions[0]?.slot ?? null;
  const s = slot ? fleet[slot - 1] : undefined;
  const lane = rk.startsWith("lane:");
  const at: GsHead["at"] = isMain ? "main" : lane ? (dia ? "lane-check" : "lane") : dia ? "branch-check" : "branch";
  const facts: GsHead = { at, board: !!bb, slot, hung: !!s && (s.stalled || s.agent === "no-agent" || s.agent === "no-pane"),
    worktree: !!w, landed: lane ? w?.target?.landed === "yes" : !!item?.merged, mirror: !!w && mirroredWorktree(w), live: isLiveLane(branch) };
  const words = headWords(facts);
  // a head with one word that only opens (a lane's checks) opens it at once — main's one word, Live session, waits for its click
  const open = word ?? (!isMain && words.length === 1 && !GS_WORD[words[0]].acts ? words[0] : null);
  const box = el("div", "");
  const s1 = el("div", "gsm1");
  // 0 — WHOSE MENU THIS IS (owner Z87: „[Zitat entfernt]“
  // ): its first line names the element it opened from
  const name = item?.name ?? branch;
  const hd = el("div", "gshd", isMain ? `${m.integration} · ${sha7(m.head) ?? "tip unknown"}`
    : dia ? `${lane ? CHECK_KIND.landCheck : "Merge check"} of ${name}` : `${lane ? "Lane" : "Branch"} ${name}`);
  if (!isMain && !dia && name !== branch) hd.append(" · ", el("span", "gsbn", branch));
  s1.appendChild(hd);
  // 1 — THE TEST INSTANCE of a branch's or a lane's own checkout (owner Z86: „[Zitat entfernt]“
  // ; Z137: main has none); a repo without the script has nothing to start, so no line stands for it
  if (words.includes("testinstanz") && w && tiLook(w).cls !== "tpl") s1.appendChild(tiLine(R.repo, w, slot, standOf));
  // 2 — AT MOST THREE FACTS: the session (a click jumps to it) and the last check; main its last land and the check after
  // it in words (owner Z86: the double diamond went; Z137: „[Zitat entfernt]“), how many sessions
  // work on it, and where it stands against its remote (owner Z135: the head's tag went)
  const said: (string | HTMLElement)[] = [];
  if (isMain && !dia) {
    const pla = postLandAudit && (postLandAudit.repo === R.repo || postLandAudit.repo === baseName(R.repo)) ? postLandAudit : null;
    const result = (p: NonNullable<typeof pla>) => p.result === "green" ? "green" : p.result === "red" ? "red" : "without a result";
    // the last land of a board branch's batch; the check after it only where it ran after that land
    const last = (boardRepo(R.repo)?.branches ?? []).flatMap((b) => b.lands.map((l) => ({ name: b.name || b.branch, at: l.at })))
      .sort((a, b) => b.at - a.at)[0];
    const after = audit ? (audit.look === "run" ? "the check after it is running" : "the check after it waits for the next run")
      : pla && last && pla.at >= last.at ? `the check after it is ${result(pla)}` : "no check after it yet";
    said.push(last ? `Last land: ${last.name}, ${agoEn(Date.now() - last.at)} ago — ${after}`
      : audit ? (audit.look === "run" ? "check after land running" : "check after land waits for the next run")
      : pla ? `check after land ${result(pla)} · ${fmtTs(pla.at)}` : "no check after land yet");
    if (m.sessions.length) said.push(`${m.sessions.length} ${m.sessions.length === 1 ? "session" : "sessions"} on ${m.integration}`);
    const remote = remoteLine(R, standOf);
    if (remote) said.push(remote);
  } else if (at === "branch-check") {
    said.push(!bb ? "Not a board branch — it has no merge check"
      : item?.merged ? `Landed ${bb.lands.at(-1)?.checked ? "with a green merge check" : "without a merge check"} · “${bb.lands.at(-1)?.subject ?? ""}”` : mergeCheckLine(bb.check));
  } else if (at !== "lane-check") {
    if (s) {
      const b = el("button", "gsfact", `Slot ${s.id} · ${slotWorks(s.id) ? "working" : s.awaiting === "owner" ? "waiting for you"
        : s.lastOutput > 0 ? `quiet for ${agoEn(Date.now() - s.lastOutput)}` : "quiet"}`) as HTMLButtonElement;
      b.type = "button";
      b.title = `Go to the session in slot ${s.id}`;
      b.onclick = (e) => { e.stopPropagation(); jumpTo(s.id); };
      said.push(b);
    } else said.push("no session");
    const gate = w?.checks.gate;
    said.push(bb ? (item?.merged ? `landed${bb.lands.at(-1)?.checked ? ", check green" : ", no check"}` : mergeCheckLine(bb.check))
      : lane && w?.target?.landed === "yes" ? `landed in ${w.target.branch}`
      : gate ? `land check ${gate.state === "green" ? "green" : gate.state === "red" ? "red" : gate.state === "running" ? "running" : gate.state === "waiting" ? "waiting" : "skipped"}`
      : "no check yet");
  }
  // a lane's checks say their state in step 2, under „Checks“ — step 1 names the head only
  const line = el("div", "gscap");
  said.slice(0, 3).forEach((x, i) => { if (i) line.append(" · "); line.append(x); });
  if (said.length) s1.appendChild(line);
  // 2b — „PASST“ (owner Z132): a board branch with commits since its last batch says which tip the owner looked at
  if (!dia && bb && bb.chargeCommits !== 0 && !facts.mirror) s1.appendChild(lookedLine(R.repo, bb, repaint));
  // 2c — WHAT IS NOT LANDED YET, as a sentence right over how it lands (owner Z135: „[Zitat entfernt]“
  // ; never a number in the box): a board branch's
  // commits since its last batch, a lane's since where it branched. A landed head's commits are on main as copies — none
  const dist = !isMain && !dia && w && !facts.landed ? distanceLine(w, bb ? bb.chargeCommits : undefined) : null;
  if (dist) s1.appendChild(el("div", "gscap gsahead", dist));
  // 3 — THE LAND FORM in step 1 (owner Z86: „[Zitat entfernt]“): a lane's in this browser, a board
  // branch's on the server
  if (!dia && words.includes("landform") && lane && w) s1.appendChild(landFormField("lane", w.path, R.repo, "On land", false));
  else if (!dia && words.includes("landform") && bb) s1.appendChild(branchLandFormField(R.repo, bb, repaint));
  // 4 — THE QUIET WORDS: what acts at once, and what opens step 2
  const rest = words.filter((id) => id !== "testinstanz" && id !== "landform");
  const row = el("div", "gswords");
  for (const id of rest) {
    const acts = GS_WORD[id].acts;
    const label = id === "session" && bb && branchBusy(R.repo, bb) ? "starting …" : GS_WORD[id].label;
    const b = el("button", `gsword${acts ? " acts" : ""}${open === id ? " on" : ""}`, label) as HTMLButtonElement;
    b.type = "button";
    if (!acts) b.setAttribute("aria-expanded", String(open === id));
    b.disabled = (id === "pruefen" && !(bb && mayCheck(bb))) || (id === "mergen" && slot !== null && mergePending.has(slot));
    b.title = id === "pruefen" ? (bb?.check ? `Check ${branch} against ${bb.chargeBase ?? "its base"} — the tree main would have after it` : "This repo has no merge check")
      : id === "mergen" ? `Merge ${branch} into ${w?.target?.branch ?? m.integration} — first the question with the diff` : label;
    b.onclick = (e) => {
      e.stopPropagation();
      if (!acts) { gsSel = { repo: R.repo, key, word: open === id ? null : id }; repaint(); return; }
      if (id === "session" && bb) void startSession(R.repo, bb, repaint);
      else if (id === "neustart" && bb && slot) void restartSession(R.repo, bb, slot, repaint);
      else if (id === "pruefen" && bb) void startCheck(R.repo, bb, repaint);
      else if (id === "mergen" && slot) void doLand(slot);
    };
    row.appendChild(b);
  }
  if (rest.length) s1.appendChild(row);
  box.appendChild(s1);
  if (!open) return box;
  const s2 = el("div", "gsm2");
  const runs = w ? runsOf(w) : { mine: [], ended: [] };
  if (open === "live") s2.appendChild(liveField(R.repo, liveArriving(R.repo, rows)));
  else if (open === "charge" && bb) s2.appendChild(branchCharge(R.repo, bb));
  else if (open === "worktree" && w) s2.append(...wtLines(R, w, wts));
  else if (open === "pruefungen" && w) s2.append(wayLine(w, runs.mine), ...runLines(runs.mine));
  if (!s2.childElementCount) return box;
  box.appendChild(s2);
  return box;
}

// THE GEAR'S PANEL under the head: two switches of what the structure shows, and how this project's lanes land (it stood
// in main's menu as „On land, every lane“ until round 7). A switch is real or it is not here
function gsSettings(repo: string): HTMLElement {
  const box = el("div", "gsset");
  const row = (key: keyof GsView, label: string, say: Record<"show" | "hide", string>) => {
    const r = el("div", "zd lf-set gsvw");
    r.dataset.view = key;
    const chips = el("span", "gsch");
    r.append(el("span", "lf-k", label), chips);
    for (const show of [true, false]) {
      const on = gsView[key] === show;
      const c = el("button", `rk-btn quiet lf-c${on ? " on" : ""}`, show ? "Show" : "Hide") as HTMLButtonElement;
      c.type = "button";
      c.title = say[show ? "show" : "hide"];
      c.setAttribute("aria-pressed", String(on));
      c.onclick = (e) => {
        e.stopPropagation();
        if (on) return;
        gsView = { ...gsView, [key]: show };
        prefSet("fleet.gs.view", JSON.stringify(gsView));
        void renderBoard();
      };
      chips.appendChild(c);
    }
    return r;
  };
  // the land form as the Projekte block built it, its choices held together like the rows above, its ⓘ by its word
  const lf = landFormField("repo", repo, repo, "Lanes land as", true);
  const chips = el("span", "gsch");
  chips.append(...lf.querySelectorAll<HTMLElement>(":scope > .lf-c"));
  lf.insertBefore(chips, lf.querySelector(":scope > .lf-hint"));
  const info = lf.querySelector(":scope > .lf-i");
  if (info) lf.insertBefore(info, chips);
  box.append(row("landed", "Landed branches", { show: "Show branches and lanes that landed and have nothing new",
    hide: "Leave out what landed and has nothing new — unless a session works there" }),
  row("idle", "Without a session", { show: "Show every branch and lane, with a session or not",
    hide: "Leave out branches and lanes no session works at and where no check runs or waits" }), lf);
  return box;
}

function jumpTo(slot: number): void {
  if (!showSlot(slot)) return;
  // on the phone Info is a page over the session: after a jump the session stands in the picture
  // (rechter-tab-notiz.md §3d), as after a pick in the session list
  if (isMobile()) setBoard(false);
  else void renderBoard();
}

// the line a worktree without a session opens: its branch, how far, what is unsaved, and Öffnen —
// closing it only where the focused session's repo carries the risk facts
function wtLines(R: WorkplaceRepo, w: WorkplaceRow, wts: WtInfo | null): HTMLElement[] {
  const out: HTMLElement[] = [];
  const line = el("div", "zd zx");
  line.dataset.for = w.path;
  const tx = el("span", "tx");
  tx.appendChild(el("span", "mono", w.branch ?? "detached"));
  const wr = wts && wts.repo === R.repo ? wts.worktrees.find((x) => x.path === w.path) : undefined;
  // the commits ahead stand in the row above (src/board.ts#gitSign) — not said twice
  if (wr) tx.appendChild(document.createTextNode(` · ${wr.dirty ? `${wr.dirty} unsaved` : "nothing unsaved"}`));
  tx.title = w.path;
  line.appendChild(tx);
  out.push(line);
  if (wr && wts) {
    const box = el("div", "zd zx2");
    box.append(...worktreeControls(wts, wr));
    out.push(box);
  } else {
    // only the focused session's repo carries the risk facts closing needs; opening works anywhere
    const box = el("div", "zd zx2");
    const acts = el("div", "rk-acts");
    const ob = el("button", "rk-btn primary", "Open") as HTMLButtonElement;
    ob.title = "Open this worktree in a free slot and jump there";
    ob.onclick = async (e) => {
      e.stopPropagation();
      if (laneReqBusy) return;
      laneReqBusy = true;
      try {
        const r = await post("/api/lanes", { repo: R.repo, attach: w.path });
        const j = (await r.json().catch(() => ({}))) as { slot?: number; error?: string };
        if (!r.ok) { alert(j.error ?? "open failed"); return; }
        await refresh();
        loadWorkplaces(true);
        if (j.slot) showSlot(j.slot);
      } finally { laneReqBusy = false; }
    };
    acts.appendChild(ob);
    box.appendChild(acts);
    box.appendChild(el("div", "hint", "Close and the note: in a session of this repo, where it says what would be lost."));
    out.push(box);
  }
  return out;
}

// the board's own 3s interval used to live here — it is armed by the poll pump now (grep
// armPolls), together with refresh(), so document.hidden is handled in exactly one place.

// --- verification tier 2 on the board: the post-land check alarm ------------------------------
// The server runs the full suite AFTER every land that moves main and gates NOTHING on the outcome
// (server.ts, runPostLandAudit). Rendering it is therefore the entire safety net — an audit nobody
// reads is an audit that never ran. The result rode the 2s poll payload for a client that had no
// reader at all, and two RED audits on 2026-07-26 went unread as the direct consequence.
//
// WHERE IT LIVES (grammatik G2.1, decision W2): in flow, never an overlay. On the desktop the
// alarm is the FIRST card of the board's machine zone — the same place as the deploy-due line,
// above "is what you are looking at even the code that is running". A phone shows the same card
// at the top of its Info window (the island's ℹ) and nothing above the island: no strip, no dot
// (owner 2026-10-07). Ack (PLA_ACK_KEY) and the adjudicate path (suite.log) stay.
export let postLandAudit: PostLandAuditInfo | null = null;
export let plaCard: HTMLElement | null = null;

// THE OWNER WORDS (owner 2026-10-08, „[Zitat entfernt]“), built from the structured payload: the
// repo by NAME (a branch's four hex said nothing), what it means in one sentence, and WHO HAS IT —
// src/plaudit.ts#plaHolder reads that off the two rails the row carries. Whether an alarm exists
// and its tone stay the classifier's (src/plaudit.ts#postLandAlarm, run by e2e/outcomes.ts).
// a repo name breaks as a whole word, never at its hyphen ("claude-|fleet"): U+2011 in the sentence
const plaRepo = (a: PostLandAuditInfo): string => baseName(a.repo ?? "").replace(/-/g, "\u2011") || "a repo";
export function plaOwnerHeadline(a: PostLandAuditInfo, tone: "red" | "unknown"): string {
  const r = plaRepo(a);
  if (tone === "red") return `The check after the land in ${r} is red`;
  if (a.remoteReason === "timeout") return `The check after the land in ${r} was cut off`;
  if (a.remoteReason === "could-not-start") return `The check after the land in ${r} could not start`;
  return `The check after the land in ${r} measured nothing`;
}
// a session's name for a sentence: its role where the server gives one (the Orchestratorin, the
// MAIN of a Program), else its label without the model the label often carries
export function sessionWord(slot: number): string {
  const s = fleet[slot - 1];
  if (!s?.cwd) return `Slot ${slot}`;
  if (s.role === "orchestrator") return "The Orchestrator";
  if (s.role === "program-main") {
    const p = programsList.find((x) => x.main?.slot === slot);
    return p ? `The MAIN of “${p.title}”` : `The MAIN in slot ${slot}`;
  }
  return nameWithoutModel(s);
}
const VERDICT_WORD: Record<string, string> = { real: "a real failure", flake: "a flake", "stale-test": "an outdated test", unknowable: "not judgeable" };
const clockDe = (ms: number) => new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
// what the owner does, in one sentence
const plaOwnerTodo = (tone: "red" | "unknown"): string => tone === "red"
  ? "Take the land back or have it repaired."
  : "Look why it did not run, and start it again.";
// WHO HAS IT, as one sentence — only what the rails record (ping, adjudication); "works on it" is
// not recorded anywhere, so no sentence claims it
export function plaHolderLine(h: PlaHolder, a: PostLandAuditInfo, tone: "red" | "unknown"): string {
  switch (h.kind) {
    case "session": return `${sessionWord(h.slot)} has it${h.since ? ` since ${clockDe(h.since)}` : ""}.`;
    case "program": return "It is in the inbox of the Program that landed.";
    case "judged": return h.verdict
      ? `Judged${h.by === "owner" ? " by you" : h.by === "rule" ? " by a rule" : ""}: ${VERDICT_WORD[h.verdict] ?? h.verdict}.`
      : "Judged before it was delivered.";
    case "gone": return `${h.slot ? `Delivered to slot ${h.slot}, where another session runs by now` : "Delivered, to whom can no longer be read"} — nobody has it now. ${plaOwnerTodo(tone)}`;
    case "waiting": return `No session in ${plaRepo(a)} can take it right now. ${plaOwnerTodo(tone)}`;
    // "Braucht dich" stands in the card's foot (plaStateWord); the sentence is only what to do
    default: return plaOwnerTodo(tone);
  }
}
// THE STATE FIRST (owner 2026-10-08, round 2: „[Zitat entfernt]“
// ): the card opens with WHO HAS IT as its first
// element — a dot and a few words — and only then says what failed. Only what the rails record: a
// delivery is "bei <Session> seit <Uhrzeit>" (typed into that session's pane — whether it reads or
// works on it is recorded nowhere), the Program's inbox, a judgement; else it needs the owner.
export function plaStateWord(h: PlaHolder): { word: string; title: string; kind: "owner" | "held" | "judged" } {
  switch (h.kind) {
    case "session": {
      const w = sessionWord(h.slot);
      const dat = w.startsWith("The ") ? `the ${w.slice(4)}` : w;
      return { word: `With ${dat}${h.since ? ` since ${clockDe(h.since)}` : ""}`, kind: "held",
        title: `Delivered into this session's pane${h.since ? ` at ${clockDe(h.since)}` : ""} — whether it works on it yet, Fleet does not record.` };
    }
    case "program": return { word: "In the Program's inbox", kind: "held",
      title: "The MAIN of the Program that landed reads it at its next look into the inbox." };
    case "judged": return { word: `${h.by === "owner" ? "Judged by you" : "Judged"}${h.verdict ? `: ${VERDICT_WORD[h.verdict] ?? h.verdict}` : ""}`, kind: "judged",
      title: h.by === "owner" ? "You judged it." : h.by === "rule" ? "Judged by a rule." : "A session judged it." };
    default: return { word: "Needs you", kind: "owner", title: "No session has this check — it waits for you." };
  }
}
// the consequence, opened by "Ansehen": what this means for the reader
export function plaOwnerNote(tone: "red" | "unknown"): string {
  return tone === "red"
    ? "Nothing was blocked, nothing taken back."
    : "A check that did not run is no pass. Nothing was measured at this land.";
}

// ONE BUILDER FOR BOTH SURFACES. Green is silent and an ack is keyed to THIS audit (PLA_ACK_KEY,
// src/plaudit.ts — the module under test); the receipt card is what an ack leaves behind, and its
// "show again" is the return path the dismissal never had (grammatik G5.1, card K7). TWO WEIGHTS
// (owner 2026-10-08): an alarm nobody holds stands at the TOP of Info, tinted, with the sentence
// what to do; one a session, the Program's inbox or a judgement holds RECEDES — one quiet line under
// the Arbeitsorte, no tint, its detail a tap away. `data-place` tells renderBoard which.
let plaOpen = false;
export function plaAlarmCard(): HTMLElement | null {
  const al = postLandAlarm(postLandAudit, prefNumber(PLA_ACK_KEY));
  if (!al) { plaCard = null; return null; }
  const a = postLandAudit!;
  const holder = plaHolder(a);
  const owner = plaNeedsOwner(holder);
  const sec = el("div", `plasec ${al.tone}${owner ? "" : " held"}`);
  sec.dataset.place = owner ? "top" : "quiet";
  sec.dataset.holder = holder.kind;
  const look = el("button", "plaack", plaOpen ? "Less" : "Look") as HTMLButtonElement;
  look.setAttribute("aria-expanded", String(plaOpen));
  look.title = "Where, when, what now — and the whole log, where the helper uploaded one";
  look.onclick = () => { plaOpen = !plaOpen; renderPostLandAudit(); };
  // ONE SHAPE FOR EVERY STATE (owner 2026-10-08: „[Zitat entfernt]“
  // 
  // ): what failed on top; only when the owner is needed, the sentence what to do under it;
  // and always the same foot — the state on the left („[Zitat entfernt]“ as its own mark in the colour
  // that means "waits for you", G0.2; or who has it), Ansehen on the right
  const sw = plaStateWord(holder);
  const state = el("div", `plastate ${sw.kind}`);
  if (sw.kind !== "owner") state.appendChild(el("span", `pladot ${al.tone}`));
  state.appendChild(el("span", "plaword", sw.word));
  state.title = sw.title;
  sec.appendChild(el("div", "plat", plaOwnerHeadline(a, al.tone)));
  if (owner) sec.appendChild(el("div", "plad", plaHolderLine(holder, a, al.tone)));
  const foot = el("div", "plafoot");
  foot.appendChild(state);
  if (owner) {
    const ack = el("button", "plaack quiet", "Seen") as HTMLButtonElement;
    ack.title = "Hides this alarm — for this check run only; the next check that is not green speaks again.";
    ack.onclick = () => {
      prefSet(PLA_ACK_KEY, String(postLandAudit?.at ?? 0));
      renderPostLandAudit();
    };
    foot.appendChild(ack);
  }
  foot.appendChild(look);
  sec.appendChild(foot);
  if (plaOpen) {
    const detail = el("div", "pladetail");
    // the raw values live here, behind Ansehen: which tip, after which lands — the classifier's own
    // line (src/plaudit.ts#postLandAlarm) stays the hover, it names the full path
    const wh = el("div", "plawhere", [plaRepo(a), `${a.main ?? "main"}@${a.mainSha?.slice(0, 8) || "?"}`,
      a.covers?.length ? `after ${a.covers.map((b) => laneNameOfBranch(b)).join(", ")}` : "which land came before it is not recorded",
      ...(a.reason ? [a.reason] : [])].join(" · "));
    wh.title = al.where;
    detail.appendChild(wh);
    detail.appendChild(el("div", "hint planote", `${fmtTs(a.at)} · ${plaOwnerNote(al.tone)}`));
    // THE WHOLE LOG, when a remote helper handed one over: `out` on the row is a 4 KB tail, and for
    // a red check the next question is "which checks, and what was around them". No link is "no log
    // arrived", never an empty page.
    const art = a.artifact;
    if (art) {
      const line = el("div", "hint planote");
      const lg = el("a", "plalog", `Log · ${Math.max(1, Math.round(art.bytes / 1024))} KB`) as HTMLAnchorElement;
      lg.href = art.url;
      lg.target = "_blank";
      lg.rel = "noopener";
      lg.title = `The whole log the helper uploaded after this verdict, ${art.bytes} bytes,`
        + ` sha256 ${art.sha256.slice(0, 12)}…. It came AFTER the row and is linked from the page — it changes nothing in the result above.`;
      line.appendChild(lg);
      detail.appendChild(line);
    }
    sec.appendChild(detail);
  }
  plaCard = sec;
  return sec;
}

// the ack's RETURN PATH: one quiet line that says the newest non-green check was seen, and takes
// the dismissal back. Absent while the alarm shows (it IS the un-acked state) and while green.
export function plaReceiptCard(): HTMLElement | null {
  const a = postLandAudit;
  if (!a || a.result === "green" || a.result === "not-applicable") return null;
  if (prefNumber(PLA_ACK_KEY) !== a.at) return null;
  const sec = el("div", "plasec seen");
  sec.dataset.place = "quiet";
  sec.appendChild(el("div", "hint planote",
    `The ${a.result === "red" ? "red" : "unmeasured"} check after the last land in ${plaRepo(a)} (${fmtTs(a.at)}) is marked as seen`));
  const back = el("button", "plaack", "show again") as HTMLButtonElement;
  back.title = "Shows the alarm again that you marked as seen.";
  back.onclick = () => { prefSet(PLA_ACK_KEY, null); renderPostLandAudit(); };
  sec.appendChild(back);
  plaCard = sec;
  return sec;
}
export const plaBoardCard = (): HTMLElement | null => plaAlarmCard() ?? plaReceiptCard();

export function renderPostLandAudit() {
  const bar = $("plaudit");
  bar.replaceChildren();
  bar.style.display = "none";
  // the card is a section of Info on both surfaces — the phone has no dot and no strip of its own
  // (owner 2026-10-07), its Info window is the one the island's ℹ opens. Swapped in place when Info
  // has one: the alarm must not wait for the board's own repaint (it rides this 2s poll on purpose),
  // and that repaint must not yank the reading position just for it. A card whose PLACE changed (top
  // ↔ under the Arbeitsorte, src/board.ts#plaAlarmCard: an alarm somebody had and nobody has any
  // more goes back on top) is not swapped where it stood: the column is drawn again and puts it there
  const had = plaCard?.isConnected ? plaCard : null;
  const card = plaBoardCard();
  if (had && card && had.dataset.place !== card.dataset.place) { had.remove(); if (boardOpen) void renderBoard(); }
  else if (had) { if (card) had.replaceWith(card); else had.remove(); }
  else if (card && boardOpen) void renderBoard();
}

// THE HELD WORD IN INFO (owner 2026-10-08: „[Zitat entfernt]“
// ): a finger resting 300 ms on a sign with data-hold sees its words in
// a capsule under it; lifting the finger hides it and does NOT press the row the sign sits in. The
// mouse reads the same words from the title, VoiceOver from the aria-label.
const HOLD_TIP_MS = 300;
function initHoldTip(): void {
  const tip = el("div", "holdtip");
  tip.setAttribute("aria-hidden", "true");
  document.body.appendChild(tip);
  let timer: ReturnType<typeof setTimeout> | undefined, shown = false;
  const hide = () => { clearTimeout(timer); timer = undefined; tip.classList.remove("on"); };
  $("board").addEventListener("pointerdown", (e) => {
    hide();
    shown = false;
    if (e.pointerType === "mouse") return;
    const t = (e.target as Element).closest<HTMLElement>("[data-hold]");
    if (!t?.dataset.hold) return;
    timer = setTimeout(() => {
      if (!t.isConnected) return;
      tip.textContent = t.dataset.hold ?? "";
      tip.classList.add("on");
      const r = t.getBoundingClientRect(), w = tip.offsetWidth;
      tip.style.left = `${Math.round(Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)))}px`;
      tip.style.top = `${Math.round(r.bottom + 8)}px`;
      shown = true;
    }, HOLD_TIP_MS);
  });
  for (const ev of ["pointerup", "pointercancel"]) document.addEventListener(ev, hide, true);
  document.addEventListener("scroll", hide, true);
  // the click that follows a held word is the finger lifting, not a press
  $("board").addEventListener("click", (e) => { if (shown) { e.stopPropagation(); e.preventDefault(); shown = false; } }, true);
}

export function initBoard(): void {
  initHoldTip();
  if (!document.getElementById("rankecss")) {
    const st = document.createElement("style");
    st.id = "rankecss";
    st.textContent = RANKE_CSS + GS_CSS;
    document.head.appendChild(st);
  }
  // the close box is the ℹ itself, pressed; closing hands the focus back to the pane's ℹ, which
  // stands again where the box was (keyboard and VoiceOver keep their place)
  const close = $("boardclose");
  close.appendChild(icon("info"));
  close.onclick = () => {
    setBoard(false);
    const own = panes[focused]?.root.querySelector<HTMLButtonElement>(".boardtoggle") ?? null;
    (own ?? document.querySelector<HTMLButtonElement>(".boardtoggle"))?.focus();
  };
  applyBoard();
}

export function setPostLandAudit(value: PostLandAuditInfo | null): void { postLandAudit = value; }
export function setGateInfo(value: GateInfo | null): void { gateInfo = value; }
export function setPostLandLive(value: PostLandAuditLiveInfo | null): void { postLandLive = value; }
export function setErrorsInfo(value: ErrorsInfo | null): void { errorsInfo = value; }
export function setMeterSuites(value: SuiteOfferRow[]): void { meterSuites = value; }
export function setDeployGapInfo(value: DeployGapInfo | null): void { deployGapInfo = value; }
export function setBundleStaleInfo(value: BundleStaleInfo | null): void { bundleStaleInfo = value; }
