import { $, el, RECENT_MS, tasksList, SlotInfo, TEntry, WorktreeInfo, api, autosList, baseName, closeFxMenu, copyText, fleet, fmtDur, fmtTs, focused, fxAsked, fxGit, fxInputEl, fxMenu, fxOpenSet, fxQuery, fxRestoreAfterPaint, fxScroll, fxSearchInput, fxStartDrag, fxTree, fxTreeOf, fxView, instanceLinks, instanceName, isMobile, landsEnabled, laneBandNames, laneLabel, laneNameOfBranch, loadTree, openActivity, openAkte, openDiff, openExplorer, openExportDlg, openMergeDiff, openPacks, openReview, openShareDlg, paintTree, panes, post, refresh, rememberShas, renderDiffInto, reviewBody, serverNow, showSlot, slotsEl, stacksOf, startRename } from "./client";
import { loadPrograms, openQueue, programsList, programsPoll, programsRead, qSelect } from "./queue";
import { prefBool, prefJSON, prefNumber, prefSet, prefSetBool, prefText } from "./prefs";
import { popover } from "./popover";
import { openLaneFounding } from "./founding";
import { askRisk } from "./dialog";
import { Shell, openShell } from "./shell";
import { PostLandAuditInfo, PostLandAuditLiveInfo, SuiteOfferRow, instanceBandText, type InstanceSource, type WorkplaceCheck, type WorkplaceChecks, type WorkplaceRepo, type WorkplaceRow, type WorkplaceStand, type Workplaces } from "./protocol";
import { projectHue } from "./marks";
import { METER_STATIONS, MeterBall, MeterStation, laneDisplayName, laneTail, meterKind, meterLine, meterRuns, mmss, suiteMeter } from "./suitemeter";
import { PLA_ACK_KEY, postLandAlarm } from "./plaudit";
import { porcelainPath } from "./gitpath";
import { icon, type IconName } from "./icons";
import { devbtn, deviceOnlineMs, devicesSection, helperDevicesInfo } from "./devices";
import { compTray, serverClock } from "./composer";
import { rightsHoldFocus, rightsSection, wireRights } from "./rights";
import { perfRebuild } from "./perfmarks";

// WHAT THIS INSTANCE IS (ranke-notiz R11, card 2026-10-06): the instance.source of the sessions
// poll — set only on an instance testinstanz.sh started, never on the live fleet. Null there, and
// every reader of it (the Arbeitsorte rows, the rights wording) keeps exactly the live picture.
let instanceSource: InstanceSource | null = null;
export function setInstanceSource(s: InstanceSource | null) { instanceSource = s; }

// the rights block reads the queue's lists through the board, never by import (src/rights.ts#wireRights)
wireRights({
  tasks: () => tasksList, programs: () => programsList, programsPoll: () => programsPoll,
  programsRead: () => programsRead, loadPrograms: () => loadPrograms(),
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
  thresholdOff: "steward" | "waiting" | "unpinned" | "harness" | "fleet" | "rail" | null;
  nudges: number; nudgedAt: number | null; gaveUp: boolean; maxNudges: number;
  session: number; taken: number | null; cap: number | null;
  // the owner's per-session setting (server.ts#patchHandover): the rail's env value, whether the
  // threshold above is this session's own, and whether the hint is on. An older server sends none of
  // the three — successionOf reads them as the fleet's values then.
  defaultPct: number; pctFrom: "session" | "fleet"; nudgeOn: boolean;
  sessionPct?: number | null;
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
  shortstat: string | null; empty: boolean }
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
  lane?: { repo: string; branch: string };
  // the repo's most recent still-undoable land (null if none) — drives the ↩ undo button
  undoable?: { branch: string; at: number } | null }
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

// ↩ undo the last land on a repo — reset main back to where THAT land found it. One press
// reverses one land off the top of the server's capped undo stack; press again for the one
// below it. The server decides with git (only if main hasn't moved since and no commit of the
// land is on a remote) and refuses safely otherwise. The landed branch survives, so the work is
// recoverable either way.
export async function doUndoLand(repo: string, branch: string): Promise<void> {
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
        if (b.t !== "text") continue;
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
// m:ss (src/suitemeter.ts#mmss), not fmtDur's whole minutes. This number ticks once a second in
// front of someone deciding whether to keep waiting, and a display that reads "8m" for sixty seconds
// looks frozen — which is the state ("is it still going?") this surface exists to answer.
export function auditLiveRows(): HTMLElement[] {
  const live = postLandLive;
  if (!live) return [];
  const rows: HTMLElement[] = [];
  const r = live.running;
  if (r?.phase === "starting") {
    // the drain holds its one-at-a-time lock but no run has stamped itself. Named rather than
    // folded into "nothing is running", which is the one thing this state is NOT.
    const row = el("div", "bstate", "⏳ post-land check · starting — a run is claimed, its target is not stamped yet");
    row.title = "Der Abfluss hält die Sperre, noch kein Lauf hat seinen Baum genannt — weder Leerlauf noch Festhänger (intern: tier-2 drain).";
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
      `⏳ post-land check · ${r.repo ?? "?"} ${r.main ?? "?"}@${sha || "(tip not resolved yet)"} · running `));
    row.appendChild(age);
    if (st) row.appendChild(document.createTextNode(` · p50 ${mmss(st.p50)} · p90 ${mmss(st.p90)} (n=${st.n})`));
    row.title = st
      ? `Der ganze Check gegen den Integrationsspit-Stand — er entscheidet nichts (intern: tier 2). p50/p90 stammen aus früheren Läufen dieses Repos (n=${st.n}); hinter der alten p90 sieht ein Lauf ungewöhnlich aus.`
      : "Der ganze Check gegen den Integrationsspit-Stand — er entscheidet nichts. Zu wenige frühere Läufe auf diesem Repo, um zu sagen, was normal aussieht (intern: tier 2).";
    rows.push(row);
    if (r.covers.length) {
      const c = el("div", "bidmeta", `covering ${r.covers.join(", ")}`);
      c.title = "Die Länder, für die dieser eine Lauf steht — ein Lauf prüft einen ganzen Baum und deckt so jedes eingrollte Land ab (intern: coalesced).";
      rows.push(c);
    }
  }
  for (const w of live.waiting) {
    const row = el("div", "bidmeta", `waiting for its check · ${w.branch} → ${w.main}@${w.mainAfter.slice(0, 8)} · landed ${gateAge(Date.now() - w.at)} ago`);
    row.title = "Dieses Land hat noch keinen Check — es rollt in den NÄCHSTEN Lauf ein. Nicht dasselbe wie „kein Check geplant“ (intern: audit waiting).";
    rows.push(row);
  }
  return rows;
}

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

// --- THE CHECKS STRIP (card R4, rechter-tab-notiz.md §3 item 3 and §3a): every suite on this machine
// as ONE word button in the Arbeitsorte's head — "Prüfungen · frei", "· 1 läuft", "· steckt 12 Min." —
// that opens the runs below it: one row per run (name · what · where, a name opens its lane), the
// stations as one counting line, who holds the machine's one-at-a-time lock, the helpers that can
// take work, a running check after the land. The glass tube with its gliding balls is gone (§3a:
// "keine Bewegung außer Farbe", G0.4); the model below is unchanged (src/suitemeter.ts).
export let meterSuites: SuiteOfferRow[] = [];
export let meterOpen = prefBool("fleet.meter.open");
export const METER_WORD: Record<MeterStation, string> = { wait: "wartet", run: "läuft", helper: "auf Helfer", done: "fertig" };
// a finished ball says HOW it finished — the station alone would call a red run "done"
export const meterState = (b: MeterBall): string =>
  b.station === "wait" ? "waiting" : b.station !== "done" ? "running"
  : b.tone === "red" ? "failed" : b.tone === "unknown" ? "no result" : "passed";
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
  wait: "Angefragt, nicht gestartet — eine Lane wartet auf die Sperre, ein Angebot nahm noch kein Helfer, ein Land rollt in den nächsten Check ein (intern: suite mutex · post-land check).",
  run: "Läuft auf dieser Maschine — was gerade die maschinenweite Sperre hält (intern: suite mutex).",
  helper: "Läuft auf einem Helfer-Gerät — ein Check, den diese Maschine abgegeben hat (intern: suite offer).",
  done: "In den letzten Minuten beendet — grün, rot oder ohne Messung.",
};
// the word on the button: what the machine's checks are doing, in one or two words (G0.5)
function meterWord(m: ReturnType<typeof meterModel>, noPane: boolean): { text: string; tone: string; title: string } {
  const lk = gateInfo?.lock ?? null;
  const held = lk ? agoDe(lk.ageMs ?? lk.heldMs).replace(/^vor /, "") : "";
  const running = meterRuns(m.balls, "run") + meterRuns(m.balls, "helper");
  const waiting = meterRuns(m.balls, "wait");
  let text: string, tone = "";
  if (m.lock === "overdue") { text = `steckt ${held}`; tone = "wait"; }
  else if (running) { text = `${running} ${running === 1 ? "läuft" : "laufen"}`; tone = "run"; }
  else if (waiting) text = `${waiting} ${waiting === 1 ? "wartet" : "warten"}`;
  else if (m.lock === "parked") text = "von Hand gesperrt";
  else if (m.lock === "unknown") text = "Halter unbekannt";
  else if (m.lock === null && !m.balls.length) text = "nicht gemeldet";
  else text = "frei";
  // without a session in the pane the strip is the column's whole machine fact: it names the helpers too
  const helpers = onlineHelpers();
  if (noPane && helpers.length) text += ` · ${helpers.length} Helfer`;
  const title = m.lock === null && !m.balls.length
    ? "Dieser Server schickt keine Lesung seiner Prüfungen — hier hat nichts gemessen. Klick klappt auf."
    : m.lock === "overdue" ? "Ein Lauf hält diesen Rechner länger als jeder Lauf hier braucht — er steckt vermutlich. Klick zeigt, welcher."
    : "Prüfungen auf diesem Rechner — klappt alle Läufe, die Sperre und die Helfer auf.";
  return { text: `Prüfungen · ${text}`, tone, title };
}
const onlineHelpers = () => deviceOnlineMs === null ? []
  : helperDevicesInfo.filter((d) => Date.now() - d.lastSeen < deviceOnlineMs!);
export function meterButton(noPane: boolean): HTMLButtonElement {
  const m = meterModel();
  const w = meterWord(m, noPane);
  const b = el("button", `meterbtn${meterOpen ? " open" : ""}${w.tone ? ` tone-${w.tone}` : ""}`) as HTMLButtonElement;
  b.type = "button";
  b.append(el("span", "mw", w.text));
  const chev = icon("chevron");
  chev.classList.add("chev");
  b.appendChild(chev);
  b.title = w.title;
  b.setAttribute("aria-expanded", String(meterOpen));
  b.setAttribute("aria-controls", "meter-runs");
  b.dataset.noPane = noPane ? "1" : "";
  b.onclick = () => {
    meterOpen = !meterOpen;
    prefSetBool("fleet.meter.open", meterOpen);
    void renderBoard();
  };
  return b;
}
export const METER_ROWS_MAX = 6;
export function meterPanel(): HTMLElement {
  const m = meterModel();
  const focusSlot = panes[focused]?.slot ?? null;
  const box = el("div", "grp rkmeter");
  box.id = "meter-runs";
  box.appendChild(el("h3", "smsectiontitle", "Alle Prüfläufe"));
  // ONE ROW PER RUN — what runs first, then what waits, then what finished (§4a `land`) — NAME ·
  // WHAT · WHERE, the state on the dot (hollow waits, filled runs, the ring says how a finished one
  // ended); a lane is NAMED, never cut to three letters
  const rank: Record<MeterStation, number> = { run: 0, helper: 1, wait: 2, done: 3 };
  const order = [...m.balls].sort((a, b) => rank[a.station] - rank[b.station] || a.at - b.at);
  for (const b of order.slice(0, meterOpen ? undefined : METER_ROWS_MAX)) {
    const mine = b.slot !== null && b.slot === focusSlot;
    const row = el("button", `smrow tone-${b.tone} st-${b.station}${mine ? " mine" : ""}`) as HTMLButtonElement;
    // the clock is recomputed on this repaint, on serverClock() because `at` is the server's stamp
    const line = meterLine(b, serverClock(), true).join(" · ");
    const name = b.kind === "post-land check" && b.slot === null ? "Fleet" : b.name;
    row.append(el("span", "smdot"), el("span", "smname", name), el("span", "smwhat", line),
      el("span", "smplace", b.where));
    // the full title and the branch (with its four hex) live HERE, not in the row
    row.title = `${name} — ${b.title ? `${b.title} · ` : ""}${b.branch ?? "Branch unbekannt"} · ${line} · ${b.where} · ${meterState(b)} · ${meterKind(b.kind).title}`
      + (b.expect ? ` · „~“ ist der Median früherer Läufe dieser Art (n=${b.expect.n}), „länger als üblich“ heißt: über ihrem 90. Perzentil` : "")
      + (b.slot !== null ? " · Klick öffnet die Lane" : "");
    const slot = b.slot;
    if (slot !== null && fleet[slot - 1]?.cwd) row.onclick = () => showSlot(slot);
    else row.disabled = true;
    box.appendChild(row);
  }
  if (!order.length) box.appendChild(el("div", "cnt", "Kein Lauf in den letzten Minuten."));
  // the stations as one counting line — RUNS, not balls (a sharded check is one ball, several runs)
  const cnt = el("div", "cnt smcount");
  METER_STATIONS.forEach((st, i) => {
    if (i) cnt.appendChild(document.createTextNode(" · "));
    const part = el("span", "", `${METER_WORD[st]} `);
    part.appendChild(el("b", "", String(meterRuns(m.balls, st))));
    part.title = METER_TITLE[st];
    cnt.appendChild(part);
  });
  box.appendChild(cnt);
  // WHO HOLDS THE MACHINE: one check at a time on this box — the holder by name, the full reading
  // (pid, identity, why, what next) in the line's hover
  const lk = gateInfo?.lock ?? null;
  const lockHead = gateInfo ? gateLockHead(lk) : null;
  const state = !gateInfo ? null : lk ? lk.state ?? (lk.alive === null ? "parked" : lk.alive ? "held" : "stale") : "free";
  const ownerSlot = lk?.owner?.slot ?? null;
  const ownerName = ownerSlot ? laneDisplayName(laneBandNames(stacksOf()).get(ownerSlot) ?? `Slot ${ownerSlot}`,
    fleet[ownerSlot - 1]?.worktree ? fleet[ownerSlot - 1]?.taskTitle ?? null : null) : "Fleet";
  const age = lk ? mmss(lk.ageMs ?? lk.heldMs) : "";
  const lockText = state === null ? "Die Sperre dieses Rechners ist nicht gemeldet"
    : state === "held" ? `Ein Lauf zur Zeit auf diesem Rechner · ${ownerName} seit ${age}`
    : state === "overdue" ? `${ownerName} hält diesen Rechner seit ${age} — länger als jeder Lauf hier`
    : state === "parked" ? `Von Hand gesperrt seit ${age}`
    : state === "unknown" ? `Halter unbekannt · seit ${age}`
    : "Ein Lauf zur Zeit auf diesem Rechner · frei";
  const lockRow = el("div", `cnt smlockrow${state === "overdue" ? " wait" : ""}`);
  const lockSpan = el("span", "", lockText);
  lockSpan.title = lockHead ? `${lockHead.textContent ?? ""} — ${lockHead.title}` : "Kein Server-Bericht über die Sperre";
  lockRow.appendChild(lockSpan);
  // …and the helpers that can take work, a click opens their register
  const helpers = onlineHelpers();
  if (helperDevicesInfo.length) {
    lockRow.appendChild(document.createTextNode(" · "));
    const hb = el("button", "lk", helpers.length ? `Helfer ${helpers.map((d) => d.name).join(", ")} bereit` : "Helfer offline") as HTMLButtonElement;
    hb.type = "button";
    hb.title = "Helfer-Geräte — das Register öffnen";
    hb.onclick = () => devbtn.click();
    lockRow.appendChild(hb);
  }
  box.appendChild(lockRow);
  // the named end of that reach, only when another instance exists to be confused with: its runs
  // are not counted here (FLEET_INSTANCES is a link list, kein Verbund)
  const elsewhere = instanceLinks.filter((l) => l.name !== instanceName);
  if (elsewhere.length) {
    const sc = el("div", "cnt smscope", `Nur ${instanceName ?? "dieser Rechner"} — ${elsewhere.map((l) => l.name).join(", ")} zählt hier nicht`);
    sc.title = `${elsewhere.map((l) => l.name).join(", ")} ${elsewhere.length === 1 ? "ist eine eigene Fleet" : "sind eigene Fleets"} mit eigener Warteschlange. `
      + "Keiner ihrer Läufe wird hier mitgezählt — eine leere Zählung hier sagt nichts über sie (FLEET_INSTANCES ist eine Linkliste, kein Verbund).";
    box.appendChild(sc);
  }
  // a running check after the land, and the lands waiting for theirs
  for (const r of auditLiveRows()) { r.classList.add("cnt"); box.appendChild(r); }
  return box;
}
// the polls call this: the strip and its panel are repainted in place, the rest of the column stays
export function renderSuiteMeter() {
  if (!boardOpen) return;
  perfRebuild("renderSuiteMeter");
  const btn = boardBody.querySelector<HTMLButtonElement>(".ranke .meterbtn");
  if (btn) btn.replaceWith(meterButton(btn.dataset.noPane === "1"));
  const panel = boardBody.querySelector<HTMLElement>(".ranke .rkmeter");
  if (panel && meterOpen) panel.replaceWith(meterPanel());
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
  head.append(el("span", "dot bad"), el("span", "t", `${e.total} Serverfehler${many ? ` · ${e.distinct} verschiedene` : ""} seit ${fmtTs(e.since)}`));
  const chev = icon("chevron");
  chev.classList.add("chev");
  head.appendChild(chev);
  head.setAttribute("aria-expanded", String(errorsOpen));
  head.style.cssText =
    "background:none;border:0;padding:0;width:100%;text-align:left;font:inherit;color:inherit;cursor:pointer;";
  head.title = "Seit dem Start dieses Servers geworfen. Nur im Speicher — ein Neustart leert die Liste,"
    + " die Geschichte bleibt in server.log. Klick zeigt jede Zeile.";
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
    `zuletzt · ${last.where} · ${last.msg}${last.n > 1 ? ` ×${last.n}` : ""} · ${fmtTs(last.at)}`));
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
  ta.placeholder = "Notiz zu diesem Worktree — wandert beim Parken und Weiterarbeiten mit";
  const foot = el("div", "bnotefoot");
  const meta = el("span", "m");
  const err = el("div", "brefusal");
  const save = el("button", "bbtn quiet bnotesave", "Notiz sichern") as HTMLButtonElement;
  save.type = "button";
  const grow = () => { ta.style.height = "auto"; ta.style.height = `${Math.min(ta.scrollHeight + 2, 320)}px`; };
  const sync = () => {
    const t = ta.value;
    notepadDraft.set(w.path, t);
    const over = t.length > WORKTREE_NOTE_MAX;
    const dirty = t !== saved;
    const count = t.length >= WORKTREE_NOTE_MAX * 0.8 ? `${t.length} / ${WORKTREE_NOTE_MAX}` : "";
    meta.textContent = over ? `${count} — über dem Deckel, kürzen (der Server nimmt nicht mehr an)`
      : [dirty ? "ungesichert" : saved ? "gesichert" : "", count].filter(Boolean).join(" · ");
    save.hidden = !dirty;
    save.disabled = over;
    foot.hidden = !meta.textContent && save.hidden;
    grow();
  };
  ta.addEventListener("input", sync);
  save.title = "sichert den Text an diesem Worktree-Pfad — er bleibt beim Parken, Wiederaufnehmen und über Neustarts erhalten";
  save.onclick = async () => {
    save.disabled = true;
    save.textContent = "sichere…";
    err.textContent = "";
    try {
      const r = await post("/api/worktrees/note", { repo, path: w.path, text: ta.value });
      if (!r.ok) {
        err.textContent = ((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Sichern fehlgeschlagen";
        return;
      }
      notepadDraft.delete(w.path); // the board now carries the saved text — the draft has served
      void renderBoard();
    } finally {
      save.disabled = false;
      save.textContent = "Notiz sichern";
    }
  };
  foot.append(meta, save);
  box.append(ta, foot, err);
  sync();
  // the height is measured once the textarea is in the document
  requestAnimationFrame(grow);
  return box;
}

// A card the column does not build itself but carries (data-board-keep: the machine's test instances,
// src/client.ts#paintTestinstanzCard) rides through every swap. Dropped and re-added by an observer
// after it, the column was that card shorter at the moment its scroll was restored: clamped, and
// every tick jumped the column under the pointer (e2e/slots.ts, "a repaint keeps the reading position").
const keptCards = (): HTMLElement[] => [...boardBody.querySelectorAll<HTMLElement>(":scope > [data-board-keep]")];

export async function renderBoard() {
  // never rebuild the board out from under an open note edit (the sidebar rename precedent): the
  // draft map keeps the TEXT across re-renders, this check keeps the CARET — a board tick that
  // lands mid-typing simply waits for the next one
  if (document.activeElement instanceof HTMLTextAreaElement && boardBody.contains(document.activeElement)) return;
  // the same hold for an open choice in the rights block: its own state survives a repaint, but a
  // rebuilt column would take the focus out from under the owner's next switch
  if (rightsHoldFocus(boardBody)) return;
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
      // the same scroll rescue the main path has, or the column jumped to the top on every tick
      const y0 = boardBody.scrollTop;
      boardPop = null;
      perfRebuild("renderBoard");
      boardBody.replaceChildren(...(pla0 ? [pla0] : []), ...(er ? [er] : []),
        arbeitsorteSection(null, null), el("div", "bempty bnopane", "Wähle eine Pane, um ihre Session zu sehen."), ...keptCards());
      boardBody.scrollTop = y0;
      drawRankeLines(boardBody);
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
    // stable key (the element's own text plus its class) finds its successor after the swap.
    // Both are read HERE, before the first section is built: a section that keeps its element
    // across ticks (the rights' grant host, src/rights.ts#paintGrant) takes it out of the live
    // column while the new nodes are assembled, the column is that much shorter for a moment, and
    // a scrollTop read then is already clamped — the restore jumped the column under the pointer.
    // From here to the swap nothing awaits, so the values are still the reader's at the swap.
    const y = boardBody.scrollTop;
    const focusKey = ((): string | null => {
      const a = document.activeElement;
      if (!(a instanceof HTMLElement) || !boardBody.contains(a)) return null;
      return `${a.tagName}\u0000${a.className}\u0000${(a.textContent ?? "").slice(0, 40)}`;
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
    const pla0 = plaBoardCard();
    if (pla0) nodes.push(pla0);
    const esec0 = errorsSection();
    if (esec0) nodes.push(esec0);
    // 1 — ARBEITSORTE: every worktree of every repo this server reads, on the machines it knows
    // (cards e66909b1, abe74821); the former lane list and test-instance card live in it
    const ranke = arbeitsorteSection(slot, wts);
    nodes.push(ranke);
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
      ng.appendChild(sectionHead("Changes", "session"));
      const e = el("div", "bempty", "Kein Git in diesem Ordner — Änderungen, Historie und Lanes gibt es nur in einem Repository.");
      e.title = `${s.cwd} ist ein einfacher Ordner; Sitzung, Prompts und Setup werden wie gewohnt gelesen`;
      ng.appendChild(e);
      nodes.push(ng);
    }
    if (briefErr) {
      const fail = el("div", "bsec bfail");
      fail.appendChild(sectionHead("Changes, history and lanes are missing", "session"));
      fail.appendChild(el("div", "bstate", `Der Session-Brief konnte nicht gelesen werden — ${briefErr}.`));
      // the server names the cause (folder gone, unreadable, git error — server.ts#cwdGitBody), so
      // the sentence no longer guesses at it; a plain folder never reaches here (noGit above)
      fail.appendChild(el("div", "bempty", "Das ist ein fehlgeschlagener Zugriff, keine leere Sitzung. Die Spalte versucht es weiter."));
      nodes.push(fail);
    }
    // 3 — CHANGES: the uncommitted tree, Commit, and on a lane Land lane with ⋯ beside it
    if (brief) {
      const work = changesSection(c, brief);
      nodes.push(work);
    }
    // 4 — THE NOTEPAD, the owner's free text on THIS lane's worktree (owner: it stays visible). Drawn
    // from the lanes read alone, so it stands even when the brief failed; a repo session (the primary
    // checkout is no board row) and a failed lanes read draw none.
    {
      const ownWt = wts?.worktrees.find((x) => x.path === s.cwd);
      if (ownWt && wts) {
        const noteSec = el("div", "bsec bnotesec");
        noteSec.appendChild(sectionHead("Notizblock", "repo"));
        noteSec.appendChild(notepadBlock(wts.repo, ownWt));
        nodes.push(noteSec);
      }
    }
    // 5 — HISTORY: the three newest commits, the full list behind one button
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
    // 6 — MORE ABOUT THIS SESSION: what is fixed at its founding or reached for rarely, as tabs with
    // a one-line summary each (G3.2); which tab is open is remembered per browser (src/prefs.ts)
    const msec = moreSection(c);
    nodes.push(msec);
    perfRebuild("renderBoard");
    boardBody.replaceChildren(...nodes, ...keptCards());
    drawRankeLines(boardBody);
    boardBody.scrollTop = y;
    // the worktree field asked to be shown: bring its row into view once, then leave the scroll alone
    const flashed = rankeScroll ? boardBody.querySelector<HTMLElement>(".zr.flash") : null;
    if (flashed) { rankeScroll = false; flashed.scrollIntoView({ block: "nearest" }); }
    const opened = popScroll && !isMobile() ? boardBody.querySelector<HTMLElement>(".bpop") : null;
    if (opened) { popScroll = false; opened.scrollIntoView({ block: "nearest" }); }
    if (popFocus) { boardBody.querySelector<HTMLElement>(`button[data-pop="${popFocus}"]`)?.focus(); popFocus = null; }
    if (focusKey) {
      for (const cand of boardBody.querySelectorAll<HTMLElement>("button, [tabindex]")) {
        if (`${cand.tagName}\u0000${cand.className}\u0000${(cand.textContent ?? "").slice(0, 40)}` !== focusKey) continue;
        cand.focus();
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

// --- THE COLUMN'S THREE POPOVERS (G4.1): the session's ⋯, the ⋯ beside Land lane, and the handover
// settings at their switch. ONE state, bound to the slot it was opened on (a focus change must not
// hang one session's actions under another's name), registered with the board's one popover().
type BoardPopKind = "kopf" | "land" | "ueb";
export let boardPop: { kind: BoardPopKind; slot: number } | null = null;
// a popover just opened: bring it into the column's view once (the draft scrolls to its anchor);
// one just closed by Escape: its button takes the focus back once the column is repainted
let popScroll = false;
let popFocus: BoardPopKind | null = null;
function popTrigger(kind: BoardPopKind, slot: number, btn: HTMLButtonElement): HTMLButtonElement {
  const open = boardPop?.kind === kind && boardPop.slot === slot;
  btn.dataset.pop = kind;
  btn.classList.toggle("on", open);
  btn.setAttribute("aria-haspopup", kind === "ueb" ? "dialog" : "menu");
  btn.setAttribute("aria-expanded", String(open));
  btn.onclick = () => { boardPop = open ? null : { kind, slot }; popScroll = !open; void renderBoard(); };
  return btn;
}
// the panel: a menu at its button on the desktop, a sheet from the bottom on the phone (G4.1 mobil)
function popPanel(kind: BoardPopKind, rows: HTMLElement[], cls = ""): HTMLElement[] {
  const p = el("div", `bpop${cls ? ` ${cls}` : ""}`);
  p.dataset.pop = kind;
  p.setAttribute("role", kind === "ueb" ? "dialog" : "menu");
  if (kind === "ueb") p.setAttribute("aria-label", "Übergabe-Einstellungen");
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
  const headName = el("div", "bheadname", headRef ? laneDisplayName(headRef, s.taskTitle) : laneLabel(s));
  if (headRef && s.worktree) headName.title = `${s.taskTitle} — ${s.worktree.branch}`;
  top.appendChild(headName);
  // Rename, Share and Export stay VISIBLE at ONE place per session (row 11e541e0) — as glyphs with
  // their sentence on hover now (R1, G1.1); the rarer copies and the restart stay behind ⋯
  const sessName = s.label ?? baseName(s.cwd ?? "");
  top.append(
    glyphBtn("pencil", "Umbenennen", "Diese Session umbenennen — der Name steht dann in der Leiste.", () => {
      const row = slotsEl.querySelector(`[data-slot="${slot}"]`);
      if (row instanceof HTMLElement) startRename(row, s);
    }),
    glyphBtn("share", s.share ? "Geteilt" : "Teilen", s.share ? "Diese Session ist nur lesend geteilt — Link und Passwort verwalten."
      : "Diese Session nur lesend teilen — ein Link mit Passwort.", () => openShareDlg(slot)),
    glyphBtn("export", "Exportieren", "Die Session exportieren — Gespräch oder Bildschirm, du wählst Teile und Format.",
      () => { void openExportDlg(slot, sessName); }),
  );
  if (s.share) top.lastElementChild?.previousElementSibling?.classList.add("shared");
  const mbtn = el("button", "bib bheadmenu") as HTMLButtonElement;
  mbtn.appendChild(icon("dots"));
  mbtn.title = "Weitere Aktionen — kopieren, die Session zurückholen";
  mbtn.setAttribute("aria-label", "Weitere Aktionen");
  top.appendChild(popTrigger("kopf", slot, mbtn));
  if (boardPop?.kind === "kopf" && boardPop.slot === slot) top.append(...popPanel("kopf", kopfItems(c)));
  idsec.appendChild(top);
  {
    const working = sessionActive(slot);
    const meta = el("div", "bheadmeta");
    meta.appendChild(el("span", `bdot${working ? " on" : ""}`));
    // no context fill and no model here: the sidebar row carries both for every session at once
    // (owner 2026-09-19). What the head adds is the one thing the row cannot: how long it is quiet.
    const word = working ? "Arbeitet" : s.lastOutput > 0 ? `Still seit ${agoDe(Date.now() - s.lastOutput).replace(/^vor /, "")}` : "Still";
    const kind = brief?.worktree ? "Lane" : noGit ? "Ordner-Session" : brief ? "Repo-Session" : "Session";
    meta.appendChild(document.createTextNode(`${word} · ${kind} in Slot ${slot}`));
    const ref = s.worktree ? bands.get(s.id) : undefined;
    if (ref) {
      meta.appendChild(document.createTextNode(" · "));
      const r = el("span", "ref", ref);
      r.style.setProperty("--proj-h", String(projectHue(s.worktree?.repo ?? s.repo ?? s.cwd ?? "")));
      r.title = "Dieselbe Adresse wie in der Leiste und am Zweig der Arbeitsorte";
      meta.appendChild(r);
    }
    const since = facts?.sessionStart ?? s.openedAt ?? null;
    if (since) meta.title = `Session seit ${new Date(since).toLocaleString()}`;
    idsec.appendChild(meta);
  }
  // THE STATES THAT ONLY EXIST WHEN THEY ARE TRUE — none of them costs a line on a healthy session
  if (s.agent === "no-agent") {
    const a = el("div", "bwait owner", "Kein Agent in dieser Pane");
    a.title = "Die Pane lebt und nimmt Tasten an, aber darin läuft nichts — Tippen erreicht keinen Agenten.";
    idsec.appendChild(a);
  }
  if (s.stalled) {
    const st = el("div", "bwait main", s.stalledSince ? `Steht still seit ${gateAge(Date.now() - s.stalledSince)}` : "Steht still");
    st.title = "Keine Ausgabe, nichts wartet auf eine Antwort — die Lane steht.";
    idsec.appendChild(st);
  }
  if (s.autoCloseRefusal) {
    const r = el("div", "brefusal", s.autoCloseRefusal);
    r.title = "Warum das automatische Schließen diese Lane offen lässt";
    idsec.appendChild(r);
  }
  if (s.awaiting) {
    const w = el("div", `bwait ${s.awaiting}`, s.awaiting === "owner" ? "Wartet auf dich" : "Wartet auf ihre MAIN");
    w.title = s.awaiting === "owner"
      ? "Diese Session hält an, bis du antwortest — ihre letzte Nachricht oder eine offene Rückfrage sagt, was sie braucht."
      : "Diese Session hält an, bis die MAIN antwortet, die sie führt.";
    idsec.appendChild(w);
  }
  if (s.mission) {
    const mi = el("div", "bmission", s.mission);
    mi.title = s.mission;
    idsec.appendChild(mi);
  }
  // THE VALUES, apart from the name by one group gap (§3b: "freistehender")
  const kv = el("div", "bkvs");
  if (brief?.worktree) {
    const branch = brief.worktree.branch;
    const bv = el("span", "mono br", branch);
    bv.title = branch;
    const cp = glyphBtn("copy", "Branch kopieren", "Branch kopieren", () => { copyText(branch); cp.classList.add("done"); setTimeout(() => cp.classList.remove("done"), 1100); });
    kv.appendChild(kvRow("Branch", [bv, cp]));
    const base = brief.laneBase ?? c.own?.target.branch ?? "main";
    const running = !!c.mg?.running;
    const bm = el("span", "mono", base);
    const n = c.ahead;
    const far = running ? `${n} ${n === 1 ? "Commit wird" : "Commits werden"} gelandet`
      : `${n} ${n === 1 ? "Commit" : "Commits"} voraus${c.behind ? ` · ${c.behind} hinter` : ""}`;
    const landsIn = kvRow("Landet in", [bm, el("span", "s1", far)]);
    landsIn.title = `Diese Lane landet in ${base} — ${far}`;
    kv.appendChild(landsIn);
    kv.appendChild(running ? landStepsRow(slot) : checkRow(c.own));
  }
  kv.appendChild(contextRow(c));
  const links = belongsLinks(c);
  if (links.length) kv.appendChild(kvRow("Gehört zu", links, "lks"));
  idsec.appendChild(kv);
  return idsec;
}

// the ⋯ of the session: the copies (Branch and Commit live here since they left the chips) and
// bringing the session back, last because it is the one with a loss
function kopfItems(c: BoardCtx): HTMLElement[] {
  const { s, slot, brief } = c;
  const items: HTMLElement[] = [];
  const copyItem = (label: string, value: string, note: string) =>
    popItem(label, `${value} — kopieren`, (b) => { copyText(value); const t = b.querySelector(".t"); if (t) t.textContent = "Kopiert"; }, note);
  if (brief?.branch) items.push(copyItem("Branch kopieren", brief.branch, `…${brief.branch.slice(-14)}`));
  if (brief?.head) items.push(copyItem("Commit kopieren", brief.head, brief.head.slice(0, 7)));
  if (brief?.worktree && s.cwd) items.push(copyItem("Worktree-Pfad kopieren", s.cwd, ""));
  if (items.length) items.push(el("div", "sep"));
  // bring session back — the repair for a pane that switched conversations on you. Claude Code
  // can change session IN-PROCESS: the pane keeps the argv it was spawned with, so nothing on
  // the outside can tell, and Escape does not undo it. A respawn does, because the slot still
  // holds the pinned sessionId and the server restarts the pane with --resume. There is no
  // deterministic signal for "this pane wandered off", so the owner decides, not a detector.
  items.push(popItem("Session zurückholen", "Die Pane neu starten und das festgehaltene Gespräch fortsetzen — der Slot behält Lane, "
    + "Name, Modell, Freigaben und geplante Prompts. Was die Session GERADE tut, geht verloren.", async (b) => {
    if (!(await askRisk({
      title: `Die Pane von Slot ${slot} neu starten und das festgehaltene Gespräch fortsetzen?`,
      body: [el("div", "bmidrun",
        "Nichts am Slot wird weggeworfen. Aber der Agent wird beendet — was er gerade tut, "
        + "ein laufender Werkzeugaufruf oder ungesendete Ausgabe, geht verloren.")],
      buttons: [
        { label: "Abbrechen", value: false },
        { label: "Neu starten", danger: true, value: true },
      ],
    }))) return;
    const t = b.querySelector(".t");
    b.disabled = true;
    if (t) t.textContent = "Startet neu…";
    const r = await post(`/api/slots/${slot}/restart`, {});
    const j = await r.json().catch(() => null) as { resumed?: boolean; error?: string } | null;
    if (!r.ok) { alert(j?.error ?? "Neustart fehlgeschlagen"); b.disabled = false; if (t) t.textContent = "Session zurückholen"; return; }
    // "fresh" means the pinned conversation could NOT be resumed (no pin, or its transcript is
    // gone) — the one outcome the owner must not mistake for success
    if (t) t.textContent = j?.resumed ? "Session ist zurück" : "Frisch gestartet — das Gespräch ließ sich nicht fortsetzen";
    await refresh();
  }, "", true));
  return items;
}

// CHECK — the lane's newest check from its Arbeitsorte row: the furthest stage that has a record
// (land check, then preview, then local proofs), its word and its age; every stage on hover
const CHECK_ORDER: (keyof WorkplaceChecks)[] = ["gate", "preview", "local"];
function checkRow(w: WorkplaceRow | null): HTMLElement {
  const v: (Node | string)[] = [];
  let title = "";
  if (!w) {
    v.push(el("span", "s1", workplaces ? "nicht gelesen" : "wird gelesen…"));
    title = "Die Arbeitsorte haben diese Lane (noch) nicht gelesen — kein Check behauptet";
  } else {
    const stage = CHECK_ORDER.find((k) => w.checks?.[k]);
    const ck = stage ? w.checks?.[stage] ?? null : null;
    const word = CHECK_STAGES.find((x) => x.stage === stage)?.word ?? "";
    const mark = el("span", `ck ${ck ? CHECK_CLASS[ck.state] : "none"}`);
    if (ck?.state === "green") mark.appendChild(icon("check"));
    else if (ck?.state === "red") mark.appendChild(icon("x"));
    v.push(mark);
    v.push(ck ? `${CHECK_WORD[ck.state]}${ck.at ? ` · ${agoDe(Date.now() - ck.at)}` : ""}` : "noch keiner");
    if (ck && stage !== "gate") v.push(el("span", "s1", word));
    title = CHECK_STAGES.map(({ stage: k, word: wd }) => {
      const x = w.checks?.[k];
      return `${wd}: ${x ? `${CHECK_WORD[x.state]}${x.at ? ` · ${agoDe(Date.now() - x.at)}` : ""}` : "noch keiner"}`;
    }).join("\n");
  }
  const r = kvRow("Check", v);
  r.title = title;
  return r;
}
// LAND — while a land runs, its four steps in the order they happen (§4a `land`): it waits for the
// check, the check runs, it lands, the check after the land. Read off the meter's land-check ball
// for this slot; without one the land is still before its check.
const LAND_STEPS = ["wartet", "wird geprüft", "gelandet", "danach"];
const LAND_STEP_TITLE = ["wartet auf die Prüfung", "wird geprüft", "gelandet", "der Check nach dem Land"];
function landStep(slot: number): { at: number; ball: MeterBall | null } {
  const ball = meterModel().balls.find((b) => b.slot === slot && b.kind === "land check") ?? null;
  return { at: ball && (ball.station === "run" || ball.station === "helper") ? 1 : 0, ball };
}
function landStepsRow(slot: number): HTMLElement {
  const { at } = landStep(slot);
  const steps = el("span", "steps");
  LAND_STEPS.forEach((word, i) => {
    const st = el("span", `st${i < at ? " done" : i === at ? " now" : ""}`);
    if (i < at) st.appendChild(icon("check"));
    else if (i === at) st.appendChild(el("span", "dot live"));
    st.appendChild(document.createTextNode(word));
    steps.appendChild(st);
  });
  const r = kvRow("Land", [steps]);
  r.title = `Land läuft: ${LAND_STEP_TITLE.map((w, i) => `${i < at ? "✓ " : i === at ? "● " : ""}${w}`).join(" → ")}`;
  return r;
}

// KONTEXT — one line instead of four (§4): the fill, and the switch that opens the handover settings
// with the threshold on its face. Whether the hint was given shows only when it was (§3a); the hint
// switched off is a state of its own and says so.
const tok = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n);
const OFF_WHY: Record<NonNullable<BriefSuccession["thresholdOff"]>, string> = {
  fleet: "auf dieser Fleet nicht eingeschaltet",
  rail: "für diese Art Session auf 0 gestellt",
  harness: "dieser Agent hat kein Übergabeband",
  steward: "die Planungs-Session wird nicht erinnert",
  waiting: "sie wartet auf dich",
  unpinned: "kein festgehaltenes Gespräch zum Messen",
};
// the answer of the last write, shown at once while the brief is read again
const succNow = new Map<number, { openedAt: number | undefined; sc: BriefSuccession; at: number }>();
function successionOf(c: BoardCtx): BriefSuccession | null {
  const fresh = succNow.get(c.slot);
  if (fresh && fresh.openedAt === c.s.openedAt && Date.now() - fresh.at < 15_000) return fresh.sc;
  const raw = c.facts?.succession;
  if (!raw) return null;
  return { ...raw, pctFrom: raw.pctFrom ?? "fleet", nudgeOn: raw.nudgeOn ?? true, defaultPct: raw.defaultPct ?? raw.thresholdPct ?? 0 };
}
function contextRow(c: BoardCtx): HTMLElement {
  const sc = successionOf(c);
  if (!sc) return kvRow("Kontext", [el("span", "s1", "nicht gemeldet")]);
  const fill = sc.fill ? `${Math.round(sc.fill.pct)} %` : "nicht messbar";
  const sw = el("button", "optsw") as HTMLButtonElement;
  sw.type = "button";
  sw.append(document.createTextNode(sc.thresholdPct !== null ? `Übergabe bei ${sc.thresholdPct} %` : "Übergabe aus"), icon("chevron"));
  sw.title = `Übergabe-Einstellungen dieser Session — ${sc.thresholdPct === null ? `aus: ${OFF_WHY[sc.thresholdOff ?? "rail"]}`
    : sc.pctFrom === "session" ? `eigene Schwelle dieser Session (Fleet: ${sc.defaultPct} %)` : "die Schwelle der Fleet"}`
    + ` · ${!sc.nudgeOn ? "Hinweis aus" : sc.nudges ? `Hinweis ${sc.nudges}× gegeben` : "Hinweis noch nicht gegeben"}`;
  popTrigger("ueb", c.slot, sw);
  const v: (Node | string)[] = [el("span", "fill", fill), " · ", sw];
  // the hint is only news where a threshold can fire — "Übergabe aus" already says the rest
  if (sc.thresholdPct !== null) {
    if (!sc.nudgeOn) v.push(el("span", "s1", "Hinweis aus"));
    else if (sc.gaveUp) v.push(el("span", "s1", `nach ${sc.nudges} Hinweisen aufgehört`));
    else if (sc.nudges) v.push(el("span", "s1", `Hinweis ${sc.nudgedAt ? clockOf(sc.nudgedAt) : "gegeben"}`));
  }
  const r = kvRow("Kontext", v, "ctx");
  const fillEl = r.querySelector<HTMLElement>(".fill");
  if (fillEl) fillEl.title = sc.fill
    ? `${sc.fill.usedTokens} von ${sc.fill.windowTokens} Tokens im Fenster (${tok(sc.fill.usedTokens)} / ${tok(sc.fill.windowTokens)}) — gegen diese Zahl misst der Server, wann die Session weitergeben soll.`
    : "Fleet kann diesen Kontext nicht messen: kein festgehaltenes Gespräch, noch kein Nutzungsrecord oder kein benennbares Fenster — das ist kein leerer Kontext.";
  if (boardPop?.kind === "ueb" && boardPop.slot === c.slot) r.append(...popPanel("ueb", handoverRows(c, sc), "ubpop"));
  return r;
}
// THE HANDOVER SETTINGS (§4): readable words for every fact of the former four rows, and the owner's
// two controls — the threshold in 5-steps and the hint on/off — written per session over
// PATCH /api/slots/:id/handover (server.ts#patchHandover). The env value stays the default.
const ubErr = new Map<number, string>();
const ubBusy = new Set<number>();
async function writeHandover(c: BoardCtx, body: { thresholdPct?: number | null; nudge?: boolean }): Promise<void> {
  if (ubBusy.has(c.slot)) return;
  ubBusy.add(c.slot);
  ubErr.delete(c.slot);
  void renderBoard();
  try {
    const r = await api(`/api/slots/${c.slot}/handover`, { method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ expectedOpenedAt: c.s.openedAt, ...body }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string; succession?: BriefSuccession | null };
    if (!r.ok || !j.succession) throw new Error(j.error ?? `HTTP ${r.status}`);
    succNow.set(c.slot, { openedAt: c.s.openedAt, sc: j.succession, at: Date.now() });
  } catch (error) {
    ubErr.set(c.slot, error instanceof Error ? error.message : String(error));
  } finally {
    ubBusy.delete(c.slot);
    void renderBoard();
  }
}
const RAIL_WAY: Record<BriefSuccession["rail"], [string, string]> = {
  lane: ["neue Session im selben Worktree", "Gleicher Branch, gleicher Slot; sie committet und schreibt einen Übergabebericht."],
  "standard-main": ["über das Program", "Die gebundene Program-MAIN gibt über ihren Program-Eintrag weiter — kein Übergabe-Commit nötig."],
  "game-maker-main": ["über den Spielstand in HANDOFF.md", "Der committete Abschnitt „Current game checkpoint“ ist der einzige Weg."],
  handoff: ["mit Übergabebericht", "Watches, geplante Prompts und Berichte ziehen mit; die Nachfolgerin bekommt eine Absicht oder einen Zeiger."],
};
function handoverRows(c: BoardCtx, sc: BriefSuccession): HTMLElement[] {
  const row = (k: string, v: (Node | string)[], h = ""): HTMLElement => {
    const r = el("div", "pr");
    r.appendChild(el("span", "k", k));
    const vv = el("span", "pv");
    vv.append(...v);
    r.appendChild(vv);
    if (h) r.appendChild(el("span", "h", h));
    return r;
  };
  const busy = ubBusy.has(c.slot);
  // a gate that cannot fire takes no setting: the band is claude's, and without the fleet's master
  // switch no tick runs at all — the reason says which, the controls stay visible but quiet
  const locked = sc.thresholdOff === "fleet" || sc.thresholdOff === "harness" || sc.thresholdOff === "steward";
  const rows: HTMLElement[] = [];
  rows.push(row("Kontext", [sc.fill ? `${tok(sc.fill.usedTokens)} von ${tok(sc.fill.windowTokens)} · ` : "nicht messbar",
    ...(sc.fill ? [el("b", "", `${Math.round(sc.fill.pct)} %`)] : [])]));
  // the effective threshold; while a gate keeps it null, the owner's own value, else the rail's
  const cur = sc.thresholdPct ?? sc.sessionPct ?? sc.defaultPct;
  const step = el("span", "stepper");
  const minus = el("button", "", "−") as HTMLButtonElement;
  minus.type = "button";
  minus.setAttribute("aria-label", "Schwelle senken");
  minus.title = `Auf ${cur - 5} % senken — nur diese Session`;
  minus.disabled = busy || locked || cur - 5 < 5;
  minus.onclick = () => void writeHandover(c, { thresholdPct: cur - 5 });
  // a gate that cannot fire has no number to step: it says "aus" instead of a 0 % nobody set
  const val = el("span", "val", locked || cur <= 0 ? "aus" : `${cur} %`);
  const plus = el("button", "", "+") as HTMLButtonElement;
  plus.type = "button";
  plus.setAttribute("aria-label", "Schwelle heben");
  plus.title = `Auf ${cur + 5} % heben — nur diese Session`;
  plus.disabled = busy || locked || cur + 5 > 95;
  plus.onclick = () => void writeHandover(c, { thresholdPct: cur + 5 });
  if (locked) minus.title = plus.title = "Hier wirkt keine Schwelle — der Grund steht darunter";
  step.append(minus, val, plus);
  const thV: (Node | string)[] = [step];
  if (sc.pctFrom === "session" && !locked) {
    const back = el("button", "lk", `zurück auf ${sc.defaultPct} %`) as HTMLButtonElement;
    back.type = "button";
    back.title = "Die Schwelle der Fleet für diese Session wieder übernehmen";
    back.disabled = busy;
    back.onclick = () => void writeHandover(c, { thresholdPct: null });
    thV.push(back);
  }
  rows.push(row("Übergabe bei", thV, sc.thresholdOff && sc.thresholdOff !== "rail"
    ? `Aus: ${OFF_WHY[sc.thresholdOff]}.`
    : sc.pctFrom === "session" ? `Ab hier soll sie an eine frische Session weitergeben. Nur für diese Session — die Fleet steht auf ${sc.defaultPct} %.`
    : `Ab hier soll sie an eine frische Session weitergeben. Die Fleet-Schwelle für ${sc.rail === "lane" ? "alle Lanes" : "alle Sessions dieser Art"} — hier nur für diese änderbar.`));
  const seg = el("span", "seg");
  for (const [on, word] of [[true, "An"], [false, "Aus"]] as const) {
    const b = el("button", sc.nudgeOn === on ? "on" : "", word) as HTMLButtonElement;
    b.type = "button";
    b.setAttribute("aria-pressed", String(sc.nudgeOn === on));
    b.disabled = busy || locked;
    b.title = on ? "Fleet schreibt dieser Session bei der Schwelle einen Hinweis" : "Fleet schreibt dieser Session keinen Hinweis — sie gibt nur weiter, wenn sie selbst entscheidet";
    b.onclick = () => { if (sc.nudgeOn !== on) void writeHandover(c, { nudge: on }); };
    seg.appendChild(b);
  }
  const given = sc.gaveUp ? `Aufgehört nach ${sc.nudges}.` : sc.nudges ? `Bisher ${sc.nudges}, zuletzt ${sc.nudgedAt ? clockOf(sc.nudgedAt) : "zu unbekannter Zeit"}.` : "Bisher keiner.";
  rows.push(row("Hinweis", [seg], `Fleet schreibt der Session bei der Schwelle einen Hinweis, höchstens ${sc.maxNudges}-mal. ${given}`));
  const [way, wayH] = RAIL_WAY[sc.rail];
  rows.push(row("Weg", [way], wayH));
  rows.push(row("Diese Session", [sc.rail === "lane" ? `die ${sc.session}. dieser Lane` : `die ${sc.session}. dieser Linie`],
    sc.cap !== null ? `${sc.taken ?? 0} von ${sc.cap} Übergaben genutzt — danach verlangt Fleet einen Bericht statt einer weiteren.`
      : sc.taken !== null ? `${sc.taken} Übergaben genutzt, ohne Deckel.`
      : sc.rail === "lane" ? "Diese Lane trägt keine Aufgaben-Zeile, also begrenzt sie kein Deckel." : "Ohne Deckel — nur Lanes mit Aufgaben-Zeile haben einen."));
  const err = ubErr.get(c.slot);
  if (err) rows.push(el("div", "perr", `Nicht gespeichert — ${err}`));
  return rows;
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
  if (s.taskId) link(`Auftrag ${s.taskId.slice(0, 8)}`, `${s.taskHead || "der Auftrag, aus dem diese Session gestartet wurde"} — öffnet die Aufgabenansicht`, () => openQueue());
  if (s.programId) {
    const p = programsPoll.find((x) => x.id === s.programId);
    link(`Program ${p?.title ? p.title.slice(0, 28) : s.programId.slice(0, 8)}`, `${p?.title ?? s.programId} — öffnet die Aufgabenansicht`, () => openQueue());
  }
  if (brief?.worktree) {
    const branch = brief.worktree.branch;
    link("Akte", "Diese Lane von Anfang bis Ende — ihr Auftrag, ihre Prompts, ihre Commits, ihr Land", () => void openAkte(branch));
  }
  return out;
}

// --- 3 CHANGES: the uncommitted tree, Commit, Land lane as THE action, Rebase only when behind, and
// Shelve · Park for review · Undo last land behind the ⋯ beside it (G4.2, danger last)
function changesSection(c: BoardCtx, brief: BriefInfo): HTMLElement {
  const { s, slot, mg, ahead, behind } = c;
  const work = el("div", "bsec bchanges");
  work.appendChild(sectionHead("Changes", "session"));
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
    work.appendChild(el("div", "bstate", `Nichts ungesichert · ${ahead} commit${ahead === 1 ? "" : "s"} werden gelandet`));
  } else if (ahead) {
    work.appendChild(el("div", "bstate", `Nichts ungesichert · ${ahead} commit${ahead === 1 ? "" : "s"} ready${brief.worktree ? "" : " to push"}`));
  } else {
    work.appendChild(el("div", "hint bnote", "Nothing uncommitted, nothing ahead."));
    if (!brief.worktree) {
      const db = el("button", "bbtn quiet", "View diff") as HTMLButtonElement;
      db.onclick = () => void openDiff(slot);
      crow.appendChild(db);
    }
  }
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
      : `Die Lane auf ${baseName_} landen — vorher wird sie geprüft. Bereits gemergte Lanes landen sofort; bei Konflikten löst ein Agent im Hintergrund und wartet auf dein Review, bevor etwas ${baseName_} erreicht.`;
    lb.onclick = () => void doLand(slot);
    crow.appendChild(lb);
  }
  // ⋯ — the rarer exits of a lane: set aside with a note, park for a later review, and undo the
  // repo's last land (danger, last). Shelve stays reachable on a follower fleet too.
  const more = el("button", "bib bland") as HTMLButtonElement;
  more.appendChild(icon("dots"));
  more.title = "Weitere Lane-Aktionen — zurückstellen, zur Prüfung parken, letztes Land zurücknehmen";
  more.setAttribute("aria-label", "Weitere Lane-Aktionen");
  more.disabled = running;
  crow.appendChild(popTrigger("land", slot, more));
  if (rebaseBtn) crow.appendChild(rebaseBtn);
  if (!landsEnabled) crow.appendChild(el("div", "bmergedetail",
    "this fleet follows a canonical main and does not land — land this branch on the canonical host"));
  if (!running && boardPop?.kind === "land" && boardPop.slot === slot) {
    const items: HTMLElement[] = [
      popItem("Shelve", "set this lane aside with a note (what's left) — kills the slot, keeps the worktree to resume later; nothing lost, nothing destroyed",
        () => { boardPop = null; void doShelve(slot); }, "mit Notiz beiseite"),
      popItem("Park for review", "park this finished lane for a later review — frees the slot, keeps worktree, task ids, head, base and the accepted report; the tasks do not start again, reopening binds them back (verify then counts as stale)",
        () => { boardPop = null; void doShelve(slot, true); }, "Slot frei, später prüfen"),
    ];
    // undo — only when the server still holds an undoable land for THIS repo (main not moved since,
    // not pushed). Reverses the one action that mutates main.
    if (mg?.undoable && brief.worktree.repo) {
      const repo = brief.worktree.repo;
      const landedBranch = mg.undoable.branch;
      items.push(el("div", "sep"), popItem(`Undo last land (${laneNameOfBranch(landedBranch)})`,
        "reset main back to before the last land in this repo — refuses if main moved since or the commit was pushed; the landed branch is kept, so the work is recoverable either way",
        () => { boardPop = null; void doUndoLand(repo, landedBranch); }, "", true));
    }
    crow.append(...popPanel("land", items));
  }
  work.appendChild(crow);
  if (running) {
    // while it lands: how far, against the usual duration of this kind of check where one exists
    const { ball } = landStep(slot);
    const note = el("div", "landnote");
    note.appendChild(el("span", "dot live"));
    const since = ball && ball.at > 0 ? mmss(serverClock() - ball.at) : null;
    note.appendChild(document.createTextNode(!ball ? "Land läuft — die Prüfung hat noch nicht begonnen"
      : ball.station === "wait" ? `wartet auf die Prüfung${since ? ` · ${since}` : ""}`
      : `wird geprüft${since ? ` · ${since}` : ""}${ball.expect ? ` von üblich ${mmss(ball.expect.p50)}` : ""}`));
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

// --- 5 HISTORY: the three newest commits; one button opens the full list as before — every commit
// the brief carries, the files they touched, and the base's own history folded (R2)
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
  csec.appendChild(sectionHead("History", "repo"));
  const base = brief.laneBase ?? "main";
  const all = boardFolds.has("history");
  if (!brief.commits.length) csec.appendChild(el("div", "bempty",
    brief.laneScoped ? `No commits on this lane yet.` : "No commits this session yet."));
  for (const cm of all ? brief.commits : brief.commits.slice(0, HISTORY_SHOWN)) csec.appendChild(commitRow(cm, "session"));
  const total = brief.laneScoped ? Math.max(ahead, brief.commits.length) : brief.commits.length;
  const more = total > HISTORY_SHOWN || brief.files.length > 0 || brief.repoCommits.length > 0;
  if (all) {
    // a list that stops at its cap must say so — for a lane the true total is `ahead`, and a
    // time-scoped session has no total, so there the cap itself is the honest sentence
    if (brief.laneScoped && ahead > brief.commits.length)
      csec.appendChild(el("div", "bempty",
        `… ${ahead - brief.commits.length} older commit${ahead - brief.commits.length === 1 ? "" : "s"} — the brief carries the newest ${brief.commitsCap}`));
    else if (!brief.laneScoped && brief.commits.length >= brief.commitsCap)
      csec.appendChild(el("div", "bempty", `the newest ${brief.commitsCap} — this session may have made more`));
    // FILES: the committed footprint — what this lane/session changes vs its base, uncut
    if (brief.files.length) {
      const fh = el("div", "bsubhead", brief.laneScoped ? `Changed vs ${base}` : "Changed files");
      if (brief.shortstat) fh.appendChild(el("span", "bsubstat", brief.shortstat.replace(/ changed|\(|\)/g, "")));
      csec.appendChild(fh);
      for (const f of brief.files) {
        const row = el("button", "bfile");
        row.appendChild(el("span", "bfst", f.slice(0, 2).trim() || "·"));
        row.appendChild(document.createTextNode(f.slice(3)));
        const path = porcelainPath(f);
        row.title = `${f} — click to see what changed in this file`;
        row.onclick = () => void openReview(slot, "working", { k: "file", path });
        csec.appendChild(row);
      }
      if (brief.filesTotal > brief.files.length)
        csec.appendChild(el("div", "bempty", `… ${brief.filesTotal - brief.files.length} more — the brief carries the first 200`));
    }
    if (brief.repoCommits.length)
      csec.appendChild(boardFold("repoCommits", brief.laneScoped ? `Already in ${base}` : "Earlier in this repo",
        String(brief.repoCommits.length), (box) => { for (const cm of brief.repoCommits) box.appendChild(commitRow(cm, "repo")); }));
  }
  if (more || all) {
    const files = brief.filesTotal || brief.files.length;
    const label = all ? "Weniger zeigen"
      : [`Alle ${total} ${total === 1 ? "Commit" : "Commits"}`, files ? `${files} ${files === 1 ? "Datei" : "Dateien"}`
        : brief.repoCommits.length ? (brief.laneScoped ? `Already in ${base}` : "Earlier in this repo") : ""].filter(Boolean).join(" · ");
    const b = el("button", "bbtn quiet bmorebtn", label) as HTMLButtonElement;
    b.type = "button";
    b.setAttribute("aria-expanded", String(all));
    b.title = all ? "Zurück auf die drei neuesten Commits" : "Die ganze History: jeder Commit, die geänderten Dateien und was schon in der Basis liegt";
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
  b.title = `${title} — ${open ? "zuklappen" : "aufklappen"}`;
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
// the rights summary needs the grant, which only the rights block reads; while the tab is CLOSED this
// asks the same owner route at most every 15 s per occupant, riding the repaint (no loop), and says
// "unbekannt" when it could not read — never "keine" (G6.5). An open tab is the block itself, which
// reads for itself: the summary then keeps its last answer and adds no second request.
const grantSum = new Map<number, { openedAt: number | undefined; at: number; text: string }>();
const grantBusy = new Set<number>();
function grantSummary(s: SlotInfo): string {
  const g = grantSum.get(s.id);
  const fresh = g && g.openedAt === s.openedAt;
  if (boardFolds.has("rechte")) return fresh ? g.text : "Projektsichten im Reiter";
  if ((!fresh || Date.now() - g.at > 15_000) && !grantBusy.has(s.id)) {
    grantBusy.add(s.id);
    const openedAt = s.openedAt;
    void api(`/api/slots/${s.id}/memory-grant`).then(async (r) => {
      const j = (await r.json().catch(() => null)) as { grant?: { projectKeys?: unknown[] } | null; inForce?: boolean } | null;
      const n = r.ok && j?.inForce && Array.isArray(j.grant?.projectKeys) ? j.grant.projectKeys.length : 0;
      grantSum.set(s.id, { openedAt, at: Date.now(), text: !r.ok || !j ? "Projektsichten unbekannt"
        : n ? `${n} ${n === 1 ? "Projektsicht" : "Projektsichten"}` : "keine Projektsichten" });
    }).catch(() => { grantSum.set(s.id, { openedAt, at: Date.now(), text: "Projektsichten unbekannt" }); })
      .finally(() => { grantBusy.delete(s.id); if (!fresh) void renderBoard(); });
  }
  return fresh ? g.text : "Projektsichten …";
}
function rightsSummary(s: SlotInfo): string {
  const program = s.programId ? programsPoll.find((x) => x.id === s.programId) : undefined;
  const own = s.worktree ? (s.taskId ? "eigener Auftrag" : "kein Auftrag")
    : s.programId ? `Program ${program?.title ? program.title.slice(0, 20) : s.programId.slice(0, 8)}` : "keine eigene Arbeit";
  return `${own} · ${s.worktree ? "keine Projektsichten" : grantSummary(s)}`;
}
function moreSection(c: BoardCtx): HTMLElement {
  const { s, slot, brief, facts, prompts, outlineErr } = c;
  const sec = el("div", "bsec bmoresec");
  sec.appendChild(sectionHead("Mehr zu dieser Session", "session"));
  const setup = facts?.setup;
  const packs = setup?.packs ?? [];
  const setupSum = [setup?.profile ?? "standard", packs.length ? `${packs.length} ${packs.length === 1 ? "Pack" : "Packs"}` : "",
    s.browser ? "Browser" : "", s.container ? "Container" : ""].filter(Boolean).join(" · ");
  sec.appendChild(boardTab("setup", "Setup", setupSum, (body) => setupBody(c, body)));
  sec.appendChild(boardTab("rechte", "Rechte", rightsSummary(s), (body) => {
    // the rights block unchanged (src/rights.ts#rightsSection) — its own head is this tab's
    const r = rightsSection(s);
    r.querySelector(":scope > h3")?.remove();
    body.appendChild(r);
  }));
  // FILES: drawn where there is a branch (the tree is `git ls-files`). The explorer opens from the
  // tab's glyph without opening the tab; the tree loads once per working directory (the latch).
  if (brief?.branch) {
    fxGit.set(s.cwd!, { lines: brief.uncommittedFiles, total: brief.uncommitted, branch: brief.branch });
    const cwd = s.cwd!;
    const known = fxTree.get(cwd);
    if (!known && !fxAsked.has(cwd)) { fxAsked.add(cwd); void loadTree(slot, cwd); }
    const ex = glyphBtn("folder", "Explorer öffnen", "Den Explorer öffnen — ohne Aufklappen", () => openExplorer(slot, cwd));
    ex.classList.add("btabx");
    const sum = !known ? "wird gelesen…" : "error" in known ? "nicht lesbar" : `${known.total} ${known.total === 1 ? "Datei" : "Dateien"}`;
    sec.appendChild(boardTab("files", "Files", sum, (body) => {
      const fx = fileTreeSection(slot, cwd);
      body.append(...fx.childNodes);
    }, ex));
  }
  sec.appendChild(boardTab("prompts", "Your prompts", outlineErr ? "nicht lesbar" : String(prompts.length), (psec) => {
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
function setupBody(c: BoardCtx, su: HTMLElement): void {
  const { s, slot, facts } = c;
  su.classList.add("bsetup");
  const row = (label: string, value: string, title?: string) => {
    const r = el("div", "bsrow");
    r.appendChild(el("span", "bskey", label));
    r.appendChild(el("span", "bsval", value));
    if (title) r.title = title;
    su.appendChild(r);
  };
  const setup = facts?.setup;
  // "Program type" since the founding window (F4): "Profile" is the founding choice there, the
  // machine profile of the PROGRAM needed a name that cannot be read as it. Absence IS standard.
  row("Program type", setup?.profile ?? "standard",
    setup?.profile === "game-maker" ? "the owner granted this session's program the game-maker profile"
      : setup?.profile === "standard" ? "this session's program runs on the standard profile"
      : "standard by default — this session has no program bracket to grant another profile");
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
    su.appendChild(el("div", "bsnote", "Packs zeigen ihr, wo sie nachlesen soll. Ein Recht geben sie nicht."));
  }
  const since = facts?.sessionStart ?? s.openedAt ?? null;
  const foot: string[] = [];
  if (since) foot.push(`open ${gateAge(Date.now() - since)}`);
  if (s.inbound) foot.push(`${s.inbound.sends} send${s.inbound.sends === 1 ? "" : "s"} today`);
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
export function loadWorkplaces(force = false): void {
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
  }).catch(() => { workplacesErr = "der Server war nicht erreichbar"; })
    .finally(() => { workplacesBusy = false; void renderBoard(); });
}

// THE WORKTREE FIELD (card e66909b1; docs/design/ranke-notiz.md §1, rechter-tab-notiz.md §3b): where
// the focused session works, said in one line at the right end of the tray — the Ranke's figure,
// the address the session list gives it, the lane's NAME (owner 2026-10-04: never a hex tail) and,
// while one runs, its test instance as the same green square the Ranke draws. A click shows that
// worktree in Info and marks it there. On the phone the field fills the island's named empty place
// "Arbeitsort" (#mort). Everything here is the poll's row plus the last Arbeitsorte read — no
// request of its own. It lives beside the Arbeitsorte it reads (moved out of src/composer.ts).
let wtFieldKey = "";
export function renderWorkplaceField(): void {
  const slot = panes[focused]?.slot ?? 0;
  const s = slot ? fleet.find((x) => x.id === slot) : undefined;
  const repo = s?.cwd ? (s.worktree?.repo ?? s.repo ?? s.cwd) : null;
  // the worktree's row in the last Arbeitsorte read — looked up again at the click, since the read
  // may arrive after the field was drawn
  const rowNow = () => {
    const rows = repo ? workplaces?.repos.find((r) => r.repo === repo)?.worktrees ?? null : null;
    return s && rows ? rows.find((w) => w.session?.slot === s.id) ?? (s.worktree ? null : rows.find((w) => w.primary) ?? null) : null;
  };
  const row = rowNow();
  const up = row?.testinstanz?.state === "up";
  const lane = s?.cwd && s.worktree ? laneBandNames(stacksOf()).get(s.id) : undefined;
  const addr = !s?.cwd || !s.git ? null : lane ?? "main";
  const name = !s?.cwd ? "" : s.worktree ? laneLabel(s) : baseName(repo ?? s.cwd);
  const key = [addr, name, up, row?.path ?? "", s?.worktree?.branch ?? "", isMobile()].join("|");
  if (key === wtFieldKey && document.getElementById("compwt")) return;
  wtFieldKey = key;
  const build = (id: string): HTMLButtonElement | null => {
    if (!addr || !s) return null;
    const b = el("button", "wtfield") as HTMLButtonElement;
    b.id = id;
    b.type = "button";
    b.append(icon("ranke"), el("span", "wtref", addr), el("span", "wtname", name));
    if (up) b.appendChild(el("span", "wtsq"));
    const branch = s.worktree?.branch ?? null;
    b.title = `${s.worktree ? `Lane ${addr} · ${name} auf ${branch}` : `Haupt-Checkout von ${baseName(repo ?? "")}`}`
      + `${up ? " · Testinstanz läuft" : ""} — Klick zeigt diesen Arbeitsort in Info`;
    b.setAttribute("aria-label", b.title);
    b.onclick = () => {
      if (!boardOpen) setBoard(true);
      flashWorkplace(rowNow()?.path ?? null);
    };
    return b;
  };
  compTray.querySelector("#compwt")?.remove();
  const desk = build("compwt");
  if (desk) compTray.appendChild(desk);
  const mort = document.getElementById("mort");
  if (mort) {
    const phone = build("mortwt");
    mort.replaceChildren(...(phone ? [phone] : []));
  }
}

// what the name column shows: the lane's name, its branch, or the commit its worktree stands on —
// a device preference (fleet.ranke.mode, src/prefs.ts), so a reload keeps the owner's choice
type RankeMode = "name" | "branch" | "stand";
const RANKE_MODES: { mode: RankeMode; word: string; glyph: IconName; title: string }[] = [
  { mode: "name", word: "Name", glyph: "label", title: "Die Namen der Lanes zeigen" },
  { mode: "branch", word: "Branch", glyph: "branch", title: "Statt der Namen die Branches zeigen — eine Zeile je Zweig bleibt" },
  { mode: "stand", word: "Stand", glyph: "commit", title: "Statt der Namen den Commit zeigen, auf dem jeder Worktree steht, und wie weit er von seinem Ziel weg ist" },
];
const rankeModeOf = (v: string): RankeMode => (v === "branch" || v === "stand" ? v : "name");
let rankeMode: RankeMode = rankeModeOf(prefText("fleet.ranke.mode"));
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
// the projects without running work behind their one row: open or not is a look, like the fold above
let rankeQuietOpen = false;
// the settings window resets the two (src/client.ts#PREF_APPLY): read them again and repaint
export function reloadRankePrefs(): void {
  rankeMode = rankeModeOf(prefText("fleet.ranke.mode"));
  rankeRepos.clear();
  const v = prefJSON<unknown>("fleet.ranke.repos");
  if (v && typeof v === "object" && !Array.isArray(v))
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (typeof x === "boolean") rankeRepos.set(k, x);
  void renderBoard();
}
// ONE open line under a row: `wt:<path>` (a worktree without a session) or `ti:<path>` (its test instance)
let rankeOpen: string | null = null;
let rankeFlash: { path: string; until: number } | null = null;
// the worktree field under the composer: show this worktree in Info and mark it for a moment
let rankeScroll = false;
export function flashWorkplace(path: string | null): void {
  if (path) { rankeFlash = { path, until: Date.now() + 1600 }; rankeScroll = true; }
  loadWorkplaces(true);
  void renderBoard();
}
const tiBusy = new Set<string>();
const tiErr = new Map<string, string>();

const sha7 = (h: string | null | undefined): string | null => (h ? h.slice(0, 7) : null);
const refShort = (ref: string): string => ref.replace(/^refs\/(heads|remotes)\//, "");
// "fleet/261004-zeitleiste-c3d4" → "zeitleiste": the words of a branch without its date and hex
// (owner 2026-10-04: the lane's name, not a hex tail). A date stands anywhere in the name as a stamp
// (261004, 260920214010) or a day (2026-10-04); a name of a date and a hex alone says the day it was
// cut (owner 2026-10-07: „[Zitat entfernt]“ twice told nothing). Without a branch the worktree is detached.
export function laneWords(branch: string | null): string {
  if (!branch) return "losgelöst";
  const bare = branch.replace(/^fleet\//, "");
  const words = bare.replace(/(^|[-_/])(?:\d{6,}|(?:19|20)\d\d-\d\d-\d\d)(?=[-_/]|$)/g, "$1")
    .replace(/[-_/][0-9a-f]{4,}$/, "").replace(/[-_/]+/g, " ").trim();
  if (words && !/^(?=.*\d)[0-9a-f]{4,}$/.test(words)) return words;
  const day = branchDay(bare);
  return day ? `Zweig vom ${day}` : branch;
}
// the day in a branch name, "20.09.": a stamp yymmdd[hhmm…] or a yyyy-mm-dd, read only when it is one
export function branchDay(branch: string): string | null {
  const m = /(?:^|[-_/])(?:(?:19|20)\d\d-(\d\d)-(\d\d)|\d\d(\d\d)(\d\d)\d*)(?=[-_/]|$)/.exec(branch);
  if (!m) return null;
  const mm = Number(m[1] ?? m[3]), dd = Number(m[2] ?? m[4]);
  return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 ? `${String(dd).padStart(2, "0")}.${String(mm).padStart(2, "0")}.` : null;
}
const clockOf = (ms: number): string => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
export function agoDe(ms: number): string {
  const min = Math.round(Math.max(0, ms) / 60_000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  return h < 36 ? `vor ${h} Std.` : `vor ${Math.round(h / 24)} Tagen`;
}

// the five beads, in the order a lane goes through them
const CHECK_STAGES: { stage: keyof WorkplaceChecks; word: string }[] = [
  { stage: "local", word: "Lokale Beweise" },
  { stage: "preview", word: "Vorschau" },
  { stage: "gate", word: "Land-Prüfung" },
  { stage: "audit", word: "Check nach dem Land" },
];
const CHECK_WORD: Record<WorkplaceCheck["state"], string> = {
  green: "grün", red: "rot", running: "läuft", waiting: "wartet auf einen Lauf", skipped: "ausgelassen",
};
const CHECK_CLASS: Record<WorkplaceCheck["state"], string> = {
  green: "ok", red: "bad", running: "run", waiting: "queue", skipped: "skip",
};
function checkBead(w: WorkplaceRow, stage: keyof WorkplaceChecks, word: string): HTMLElement {
  const c = w.checks?.[stage] ?? null;
  const i = el("i", "");
  i.dataset.stage = stage;
  if (!c) {
    const why = w.reasons.find((r) => r.field === `checks.${stage}`)?.reason ?? "";
    const unknown = /unreadable|malformed|capped|unmeasured/.test(why);
    i.className = unknown ? "unk" : "none";
    i.dataset.state = unknown ? "unknown" : "none";
    i.title = `${word}: ${unknown ? "unbekannt — die Aufzeichnung ist nicht lesbar" : "noch keiner bekannt"}`;
    return i;
  }
  // the check after the land names the INTEGRATION commit, never this worktree's HEAD: "stale" there
  // says nothing about the lane and is not drawn
  const stale = stage !== "audit" && c.stale === true;
  i.className = `${CHECK_CLASS[c.state]}${stale ? " stale" : ""}`;
  i.dataset.state = `${c.state}${stale ? "-stale" : ""}`;
  const bits = [`${word}: ${CHECK_WORD[c.state]}`];
  if (c.at) bits.push(agoDe(Date.now() - c.at));
  if (stale) bits.push("auf einem älteren Stand als dieser Worktree");
  if (c.fails.length) bits.push(c.fails.slice(0, 3).join(", "));
  i.title = bits.join(" · ");
  return i;
}
// IN ITS TARGET — the owner's question of 2026-10-04 („[Zitat entfernt]“
// ), answered from WorkplaceRow.target only: a land note proves "yes", own commits
// without one say "no", everything else is unknown or nothing to land
function landedMark(w: WorkplaceRow): HTMLElement {
  const b = el("b", "");
  const t = w.target;
  b.dataset.landed = t.landed ?? "null";
  if (t.landed === "yes") {
    b.className = "yes";
    b.title = `gelandet als ${sha7(t.landedAs) ?? "unbekannt"} in ${t.branch}`;
  } else if (t.landed === "no") {
    b.className = "no";
    b.title = `noch nicht auf ${t.branch}`;
  } else if (w.reasons.some((r) => r.field === "target.landed" && r.reason === "nothing-to-land")) {
    b.className = "nil";
    b.title = `nichts zu landen — keine eigenen Commits über ${t.branch}`;
  } else {
    b.className = "unk";
    b.title = `unbekannt, ob auf ${t.branch} gelandet`;
  }
  return b;
}
function checkBeads(w: WorkplaceRow): HTMLElement {
  const box = el("span", "pf");
  box.setAttribute("role", "img");
  const parts = CHECK_STAGES.map(({ stage, word }) => checkBead(w, stage, word));
  const landed = landedMark(w);
  box.append(parts[0], parts[1], parts[2], landed, parts[3]);
  box.setAttribute("aria-label", [parts[0], parts[1], parts[2], landed, parts[3]].map((p) => p.title).join(" · "));
  return box;
}

// THE TEST INSTANCE as a square in its worktree's row. "läuft" only where the server measured it up
// (process identity AND an answer over HTTP, docs/self-api.md, Testinstanz) — never from a pid.
type TiLook = { cls: string; state: string; word: string; expiresAt: number | null };
function tiLook(w: WorkplaceRow): TiLook {
  const inst = w.testinstanz?.instance as { expiresAt?: number | null } | undefined;
  const expiresAt = typeof inst?.expiresAt === "number" ? inst.expiresAt : null;
  if (w.template === "missing") return { cls: "tpl", state: "no-template", word: "keine Testinstanz-Vorlage in diesem Repo", expiresAt };
  const st = w.testinstanz?.state ?? null;
  if (st === "up") return { cls: "up", state: "up", word: `Testinstanz läuft${expiresAt ? ` bis ${clockOf(expiresAt)}` : ""}`, expiresAt };
  if (st === "expired") return { cls: "exp", state: "expired", word: `Testinstanz abgelaufen${expiresAt ? ` ${agoDe(Date.now() - expiresAt)}` : ""}`, expiresAt };
  if (st === "not-running") return { cls: "off", state: "not-running", word: "keine Testinstanz", expiresAt };
  if (st === "http-failed" || st === "http-timeout") return { cls: "bad", state: st, word: "Testinstanz antwortet nicht", expiresAt };
  return { cls: "unk", state: "unknown", word: "Testinstanz: unbekannt", expiresAt };
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
    if (action === "open") {
      if (!j.url) throw new Error("der Server hat keinen Link geliefert");
      if (tab) tab.location.href = j.url; else window.open(j.url, "_blank", "noopener");
    }
  } catch (error) {
    tab?.close();
    tiErr.set(w.path, error instanceof Error ? error.message : String(error));
  } finally {
    tiBusy.delete(w.path);
    loadWorkplaces(true);
  }
}
function tiSquare(w: WorkplaceRow, here: boolean): HTMLElement {
  const look = tiLook(w);
  const box = el("button", `ti ${look.cls}${here ? " mine" : ""}${rankeOpen === `ti:${w.path}` ? " open" : ""}`) as HTMLButtonElement;
  box.type = "button";
  box.dataset.ti = look.state;
  box.appendChild(el("span", "sq"));
  const verb = look.cls === "up" ? "Klick: Öffnen, Stoppen" : look.cls === "off" ? "Klick: Starten"
    : look.cls === "exp" ? "Klick: neu starten" : look.cls === "tpl" ? "" : "Klick: neu lesen";
  box.title = verb ? `${look.word} — ${verb}` : look.word;
  box.setAttribute("aria-label", box.title);
  if (look.cls === "tpl") { box.disabled = true; return box; }
  box.onclick = (e) => {
    e.stopPropagation();
    rankeOpen = rankeOpen === `ti:${w.path}` ? null : `ti:${w.path}`;
    void renderBoard();
  };
  return box;
}
function tiLine(repo: string, w: WorkplaceRow, slot: number | null, standOf: Map<string, WorkplaceStand>): HTMLElement {
  const look = tiLook(w);
  const line = el("div", "zd ti");
  line.dataset.for = w.path;
  const tx = el("span", `tx ${look.cls}`);
  // running, the square and the deadline say it; otherwise the word names what the square stands for
  tx.appendChild(el("span", `sq ${look.cls}`));
  if (look.cls !== "up") tx.appendChild(el("span", "k", "Testinstanz"));
  const busy = tiBusy.has(w.path);
  const err = tiErr.get(w.path);
  const inst = w.testinstanz?.instance as { recordedSource?: { before?: { head?: string | null } | null } | null; port?: number | null } | undefined;
  const from = sha7(inst?.recordedSource?.before?.head ?? null);
  const word = busy ? "wird ausgeführt…" : look.cls === "up" ? (look.expiresAt ? `bis ${clockOf(look.expiresAt)}` : "läuft")
    : look.cls === "exp" ? "abgelaufen" : look.cls === "off" ? "keine" : look.cls === "bad" ? "antwortet nicht" : "unbekannt";
  tx.appendChild(document.createTextNode(look.cls === "up" ? word : `· ${word}`));
  // WHERE IT COMES FROM: the commit the copy was taken from, as recorded at the copy — not proof of
  // what runs in it (copyHead stays null on the wire, docs/self-api.md)
  const stand = standOf.get(`test-instance:${w.path}`);
  tx.title = [look.word,
    from ? `kopiert von ${from} — welcher Stand in der Kopie läuft, ist nicht belegt` : "Stand der Kopie nicht belegt",
    stand && stand.head === null ? "läuft auf: unbekannt" : ""].filter(Boolean).join(" · ");
  if (from && look.cls === "up") tx.appendChild(el("span", "mono", from));
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
    act("Öffnen", `Die Testinstanz in einem neuen Tab öffnen${typeof inst?.port === "number" ? ` (Port ${inst.port})` : ""}`, "open", true);
    act("Stoppen", "Die Testinstanz beenden — die Kopie läuft dann nicht mehr", "down");
  } else if (look.cls === "off") act("Starten", "Eine Testinstanz dieses Worktrees starten — eigene Kopie, eigener Port, für 4 Std.", "up", true);
  else if (look.cls === "exp") {
    act("Neu starten", "Die abgelaufene Testinstanz neu starten — für 4 Std.", "up", true);
    act("Stoppen", "Die abgelaufene Testinstanz aufräumen", "down");
  } else act("Neu lesen", "Den Zustand der Testinstanz neu messen — startet nichts", "refresh");
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
  const open = el("button", "rk-btn primary", w.review ? "Wieder aufnehmen" : "Öffnen") as HTMLButtonElement;
  open.title = w.review
    ? `Prüf-Kandidat ${w.review.id} in einem freien Slot wieder aufnehmen — seine Aufträge binden zurück, Beweise von vor dem Parken gelten als veraltet`
    : "Diesen Worktree in einem freien Slot öffnen und dorthin springen";
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
  const close = el("button", "rk-btn del", "Schließen…") as HTMLButtonElement;
  close.title = w.empty
    ? "Diesen Worktree schließen — sauber, nichts geht verloren"
    : "Dieser Worktree hat ungesicherte oder nicht gelandete Arbeit — zeigt zuerst, was verloren ginge";
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
      + (c.expired ? ` · Frist abgelaufen ${new Date(c.expiresAt).toLocaleString()} — Entscheidung fällig`
        : ` · Frist ${new Date(c.expiresAt).toLocaleString()}`)));
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
  server: "betrifft den Server-Code", "helper-daemon": "betrifft den Helfer-Dienst", repository: "betrifft Code",
};
function standSentence(st: WorkplaceStand): { text: (Node | string)[]; title: string; node: string; behindCode: boolean } {
  const parts: (Node | string)[] = [];
  const titles: string[] = [];
  const head = sha7(st.head);
  parts.push("läuft auf ");
  if (head) parts.push(el("span", "mono", head));
  else parts.push(el("span", "q", "unbekannt"));
  const t = st.target;
  let behindCode = false;
  if (head && t) {
    const ref = refShort(t.ref);
    const d = t.distance;
    if (!d) parts.push(` · Abstand zu ${ref} unbekannt`);
    else if (d.ahead === 0 && d.behind === 0) parts.push(` · neuester Stand von ${ref}`);
    else {
      parts.push(` · ${[d.behind ? `${d.behind} hinter` : "", d.ahead ? `${d.ahead} vor` : ""].filter(Boolean).join(", ")} ${ref}`);
      if (d.behind) {
        if (t.codeBehind === true) { parts.push(" · "); parts.push(el("span", "cb", SCOPE_WORD[st.codeScope])); behindCode = true; }
        else if (t.codeBehind === false) parts.push(" · eigener Code aktuell");
        else parts.push(" · ob eigener Code betroffen ist: unbekannt");
      }
    }
    if (t.mergeBase) titles.push(`abgezweigt von ${ref} bei ${sha7(t.mergeBase)}`);
  }
  if (!head) {
    if (st.basis === "link-only") parts.push(" · ihre Repos liest dieser Server nicht");
    else if (st.basis === "checkout-unproven") {
      if (st.reportedCheckout) { parts.push(" · Checkout "); parts.push(el("span", "mono", sha7(st.reportedCheckout.head) ?? "")); }
      titles.push("die Instanz meldet nur ihren Checkout, nicht den Stand ihres laufenden Prozesses");
    } else if (st.basis === "copy-unproven") titles.push("eine Testkopie meldet keinen belegten Stand");
    else if (st.basis === "heartbeat") {
      // a helper without a stand still says when it last spoke at all: weeks of silence are the fact
      parts.push(st.observedAt ? ` · zuletzt gemeldet ${agoDe(Date.now() - st.observedAt)}` : " · hat sich nie gemeldet");
      titles.push("der Helfer hat noch keinen Stand gemeldet");
    }
  }
  if (head && st.basis === "heartbeat" && st.observedAt) titles.push(`zuletzt gemeldet ${agoDe(Date.now() - st.observedAt)} — ein letzter Bericht, kein Beweis, dass er gerade erreichbar ist`);
  if (st.update) titles.push(`Aktualisierung: ${st.update.state}${st.update.mainSha ? ` auf ${sha7(st.update.mainSha)}` : ""}`);
  const node = st.kind === "live-server" ? (behindCode ? "wait" : "live") : head ? "" : "leer";
  return { text: parts, title: titles.join(" · "), node, behindCode };
}
// THE TEST INSTANCE'S OWN ROW, in the machine group: the same words the band above the app paints
// (src/protocol.ts#instanceBandText, minus the branch — the row sits under the machine's name), so
// both sights of one fact cannot drift. Neutral square: the copy is neither live nor waiting.
function testInstanceStandRow(source: InstanceSource): HTMLElement {
  const row = el("div", "zr stand");
  row.dataset.kind = "live-server";
  row.appendChild(el("span", "nd leer"));
  const band = instanceBandText(source, (ms) => new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
  const nm = el("span", "nm");
  nm.appendChild(el("b", "", "Testinstanz"));
  nm.appendChild(document.createTextNode(" · "));
  band.segments.slice(1).forEach((seg, i) => {
    if (i) nm.appendChild(document.createTextNode(" · "));
    for (const run of seg) nm.appendChild(run.mono ? el("span", "mono", run.t) : document.createTextNode(run.t));
  });
  row.appendChild(nm);
  row.title = band.title;
  return row;
}
function machineHead(name: string, sub: string, title: string): HTMLElement {
  const row = el("div", "zr mach");
  const fx = el("span", "fx");
  fx.appendChild(icon("screen"));
  row.appendChild(fx);
  const nm = el("span", "nm", name);
  nm.appendChild(el("span", "cnt", sub));
  row.appendChild(nm);
  row.title = title;
  return row;
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
    const key = st.name ? machineKey(st.name) : `\0${st.kind}${st.kind === "linked-instance" ? i : ""}`;
    out.set(key, [...(out.get(key) ?? []), st]);
  });
  for (const list of out.values()) list.sort((a, b) => CARRIER_ORDER.indexOf(a.kind) - CARRIER_ORDER.indexOf(b.kind));
  return out;
}
function rolesOf(list: WorkplaceStand[]): string[] {
  return [list.some((st) => st.kind === "helper-daemon" || st.kind === "helper-instance") ? "Helfer" : "",
    list.some((st) => st.kind === "linked-instance") ? "verlinkt" : ""].filter(Boolean);
}
function carrierWord(st: WorkplaceStand): string {
  return st.kind === "helper-daemon" ? "Helfer-Dienst" : st.kind === "helper-instance" ? "Instanz"
    : st.kind === "linked-instance" ? "Fleet-Instanz" : "Live";
}
type MachineLead = { label: string | null; st: WorkplaceStand; due?: boolean; dueTitle?: string }
  | { label: string; text: string; node: string; kind: string };
type MachineFact = { label: string; text: string | null; st: WorkplaceStand | null };
function machineRow(key: string, name: string, roles: string[], lead: MachineLead | null, facts: MachineFact[], about: string): HTMLElement[] {
  const row = el("div", "zr mach");
  const fx = el("span", "fx");
  fx.appendChild(icon("screen"));
  row.appendChild(fx);
  const nm = el("span", "nm", name);
  if (roles.length) nm.appendChild(el("span", "cnt", roles.join(" · ")));
  row.appendChild(nm);
  const titles = [name + (roles.length ? ` · ${roles.join(" · ")}` : "")];
  // what a tap opens: the lead's own reasons, then every other carrier in its own words
  const lines: (Node | string)[][] = [];
  if (lead) {
    row.classList.add("one");
    const say = el("span", "st");
    if ("st" in lead) {
      const s = standSentence(lead.st);
      row.dataset.kind = lead.st.kind;
      row.appendChild(el("span", `nd ${s.node}`));
      if (lead.label) { say.appendChild(el("b", "", lead.label)); say.appendChild(document.createTextNode(" · ")); }
      say.append(...s.text);
      if (lead.due) { row.classList.add("due"); titles.push(lead.dueTitle ?? ""); }
      if (s.title) { lines.push([s.title]); titles.push(s.title); }
    } else {
      row.dataset.kind = lead.kind;
      row.appendChild(el("span", `nd ${lead.node}`));
      say.append(el("b", "", lead.label), ` · ${lead.text}`);
    }
    row.appendChild(say);
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

// RUNNING WORK in a project: a lane (a worktree with its session), a session that works or waits
// right now, or a land on its way (its land check runs or queues). A session that only sits in the
// main checkout marks a place, not work; an unreadable project stands open with its reason.
function workSlot(w: WorkplaceRow): SlotInfo | undefined {
  if (!w.session) return undefined;
  const s = fleet[w.session.slot - 1];
  return s?.cwd && (s.openedAt === undefined || s.openedAt === w.session.openedAt) ? s : undefined;
}
function repoAtWork(R: WorkplaceRepo): boolean {
  if (R.worktrees === null) return true;
  const busy = (s: SlotInfo) => sessionActive(s.id) || !!s.awaiting;
  for (const w of R.worktrees) {
    const s = workSlot(w);
    if (s && (!w.primary || busy(s))) return true;
    const gate = w.checks.gate?.state;
    if (gate === "running" || gate === "waiting") return true;
  }
  return fleet.some((s) => !!s.cwd && !s.worktree && (s.repo ?? s.cwd) === R.repo && busy(s));
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

// one row of the Ranke: the node, the address, the name, ↑•, the beads and the square
function rowCells(row: HTMLElement, node: string, ref: string, hue: number, name: HTMLElement): void {
  row.appendChild(el("span", `nd ${node}`));
  const r = el("span", "ref", ref);
  r.style.setProperty("--proj-h", String(hue));
  row.append(r, name);
}

export function arbeitsorteSection(focusSlot: number | null, wts: WtInfo | null): HTMLElement {
  loadWorkplaces();
  const sec = el("div", "bsec ranke");
  const hd = sectionHead("Arbeitsorte", "fleet");
  // the head's right end: the name column's switch as three glyphs, and the checks strip (R4)
  const act = el("span", "act");
  const seg = el("span", "rkseg");
  seg.setAttribute("role", "group");
  seg.setAttribute("aria-label", "Die Namensspalte zeigt");
  for (const m of RANKE_MODES) {
    const b = el("button", m.mode === rankeMode ? "on" : "") as HTMLButtonElement;
    b.type = "button";
    b.appendChild(icon(m.glyph));
    b.title = m.title;
    b.dataset.mode = m.mode;
    b.setAttribute("aria-label", m.word);
    b.setAttribute("aria-pressed", String(m.mode === rankeMode));
    b.onclick = () => { rankeMode = m.mode; prefSet("fleet.ranke.mode", m.mode === "name" ? null : m.mode); void renderBoard(); };
    seg.appendChild(b);
  }
  act.append(seg, meterButton(focusSlot === null));
  hd.appendChild(act);
  sec.appendChild(hd);
  if (meterOpen) sec.appendChild(meterPanel());
  const wp = workplaces;
  if (!wp) {
    sec.appendChild(el("div", "bempty", workplacesErr ? `Die Arbeitsorte konnten nicht gelesen werden — ${workplacesErr}.` : "lese die Arbeitsorte…"));
    return sec;
  }
  if (workplacesErr) sec.appendChild(el("div", "bstale", `Stand von ${clockOf(wp.measuredAt)} — neu lesen ging nicht: ${workplacesErr}`));
  const focus = focusSlot ? fleet[focusSlot - 1] : undefined;
  const bands = laneBandNames(stacksOf());
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
  const hereName = instanceName ?? "Dieser Rechner";
  const hereRoles = [instanceName ? "dieser Rechner" : "", ...rolesOf(hereOwn)].filter(Boolean);
  const hereFacts = hereOwn.map((st) => st.kind === "linked-instance"
    ? { label: "Fleet-Instanz", text: "verlinkt — das ist dieser Server", st: null } : { label: carrierWord(st), text: null, st });
  const lives = (wp.stands ?? []).filter((st) => st.kind === "live-server");
  if (instanceSource) {
    // A TEST INSTANCE DOES NOT CALL ITSELF LIVE (owner, 2026-10-06): the copy has no .git, so its
    // boot head is unreadable and its row would read „[Zitat entfernt]“. It names itself
    // and carries the stand measured BEFORE the copy (instance.source), in the band's own words.
    here.append(...machineRow("here", hereName, hereRoles, null, hereFacts,
      "Der Rechner, auf dem dieser Fleet-Server läuft — darunter jedes Repo, das er liest"));
    here.appendChild(testInstanceStandRow(instanceSource));
  } else {
    // "deploy due" lives HERE now (§3, I3): it is the same statement as the Live row — does the running
    // server carry the newest code — so a due restart renames the row in the wait colour (G0.2: amber
    // means unmeasured, a due restart waits on you), and an outdated page bundle adds its own line
    const restartDue = deployGapInfo?.codeBehind === true;
    const [live, ...moreLives] = lives;
    let lead: MachineLead | null = null;
    if (live) {
      const due = restartDue || live.target?.codeBehind === true;
      lead = { label: due ? "Neustart fällig" : "Live", st: live, due,
        dueTitle: "Der laufende Server bootet von einem älteren Commit, und der Unterschied berührt Server-Code: neu starten, dann läuft dieser Stand." };
    } else if (deployGapInfo) {
      // an older server without stands: the deploy gap alone, said as plainly
      const n = deployGapInfo.behindCount;
      lead = { label: "Live", text: `läuft auf ${sha7(deployGapInfo.bootHead) ?? "unbekannt"}${n === null ? "" : n === 0 ? " · neuester Stand" : ` · ${n} hinter`}`,
        node: deployGapInfo.codeBehind ? "wait" : "live", kind: "live-server" };
    }
    here.append(...machineRow("here", hereName, hereRoles, lead,
      [...moreLives.map((st) => ({ label: "Live", text: null, st })), ...hereFacts],
      "Der Rechner, auf dem dieser Fleet-Server läuft — darunter jedes Repo, das er liest"));
    if (bundleStaleInfo?.stale === true) {
      const row = el("div", "zr stand due");
      row.dataset.kind = "bundle";
      row.appendChild(el("span", "nd wait"));
      const nm = el("span", "nm");
      nm.append(el("b", "", "Seite neu bauen"), " · der Code im Browser ist älter als src/");
      row.appendChild(nm);
      row.title = "Der Browser zeigt einen älteren Stand — im Terminal `bun run build` ausführen, dann ist er aktuell (public/*.js sind Bauartefakte).";
      here.appendChild(row);
    }
  }
  sec.appendChild(here);

  // THE PROJECTS (owner 2026-10-07: „[Zitat entfernt]“): a project
  // with running work (repoAtWork) and the focused session's project stand open; every other one
  // waits behind ONE row, a tap away, and opens there like any project
  const focusRepo = focus?.cwd ? (focus.worktree?.repo ?? focus.repo ?? focus.cwd) : null;
  const quiet = wp.repos.filter((R) => R.repo !== focusRepo && !repoAtWork(R));
  for (const R of wp.repos) if (!quiet.includes(R)) sec.appendChild(repoGroup(R, focusSlot, focusRepo, wts, bands, standOf));
  if (quiet.length) {
    const g = el("div", "grp");
    const f = el("div", `zr zq ${rankeQuietOpen ? "auf" : "zu"}`);
    const fx = el("span", "fx");
    fx.appendChild(icon("chevron"));
    f.appendChild(fx);
    f.appendChild(el("span", "nm", `${quiet.length} ${quiet.length === 1 ? "Projekt" : "Projekte"} ohne laufende Arbeit`));
    f.title = `${quiet.map((R) => baseName(R.repo)).join(", ")} — keine Lane, keine arbeitende Session, kein Land unterwegs · ${rankeQuietOpen ? "zuklappen" : "aufklappen"}`;
    rowTarget(f, () => { rankeQuietOpen = !rankeQuietOpen; void renderBoard(); });
    f.setAttribute("aria-expanded", String(rankeQuietOpen));
    g.appendChild(f);
    sec.appendChild(g);
    if (rankeQuietOpen) for (const R of quiet) sec.appendChild(repoGroup(R, focusSlot, focusRepo, wts, bands, standOf));
  }

  // 2 — THE OTHER MACHINES: helpers by their fleet name, then each linked instance — one row each,
  // whatever reports under the name
  const helpers = new Map([...machines].filter(([, list]) => list.some((st) => st.kind !== "linked-instance")));
  for (const [key, list] of machines) {
    const [first, ...rest] = list;
    const g = el("div", "grp");
    g.append(...machineRow(key, first.name ?? (first.kind === "linked-instance" ? "verlinkte Fleet" : "Helfer ohne Namen"), rolesOf(list),
      { label: first.kind === "linked-instance" ? null : carrierWord(first), st: first },
      rest.map((st) => ({ label: carrierWord(st), text: null, st })),
      helpers.has(key) ? "Ein Helfer-Gerät dieser Fleet — sein Stand ist sein letzter Bericht" : "Eine verlinkte Fleet-Instanz — nur ein Link, keine Verbindung"));
    sec.appendChild(g);
  }
  if (instanceSource && !helpers.size) {
    // HELPER DEVICES NEVER VANISH SILENTLY (owner, 2026-10-06): a snapshot carries none (their data
    // is stripped at the copy), so the group says so instead of being absent. The live fleet keeps
    // its old picture: helpers stand when they report, and a fleet truly without any says nothing.
    const g = el("div", "grp");
    g.appendChild(machineHead("Helfer", "in der Testinstanz nicht gemeldet",
      "Helfer-Geräte gehören zur echten Fleet — der Kopiervorgang einer Testinstanz trägt sie nicht über, darum meldet diese Instanz keinen."));
    sec.appendChild(g);
  }
  return sec;
}

function repoGroup(R: WorkplaceRepo, focusSlot: number | null, focusRepo: string | null, wts: WtInfo | null,
  bands: Map<number, string>, standOf: Map<string, WorkplaceStand>): HTMLElement {
  const g = el("div", "grp");
  g.dataset.repo = R.repo;
  const hue = projectHue(R.repo);
  const rows = R.worktrees ?? [];
  const primary = rows.find((w) => w.primary) ?? null;
  const branchOf = (name: string) => R.branches?.find((b) => b.branch === name) ?? null;
  const targetOf = (w: WorkplaceRow) => w.target?.branch ?? w.base?.branch ?? "main";
  const overhaul = branchOf("overhaul");
  const hasOverhaul = !!overhaul || rows.some((w) => !w.primary && targetOf(w) === "overhaul");
  // A BRANCH STANDS ONCE (owner 2026-10-07): a worktree checked out on a branch the Ranke draws as a
  // stem IS that stem — its session and its test instance hang on the stem row, not on a second one
  const stemWt = new Map<string, WorkplaceRow>();
  for (const w of rows) if (!w.primary && w.branch && (w.branch === "main" || (hasOverhaul && w.branch === "overhaul"))) stemWt.set(w.branch, w);
  const lanes = rows.filter((w) => !w.primary && !(w.branch && stemWt.get(w.branch) === w));
  const isOpen = rankeRepos.get(R.repo) ?? (R.repo === focusRepo || repoAtWork(R));
  const slotOf = workSlot;
  // the repo's head: chevron, name, how many branches, where it comes from, + Lane
  const head = el("div", `zr repo ${isOpen ? "auf" : "zu"}`);
  const fx = el("span", "fx");
  fx.appendChild(icon("chevron"));
  head.appendChild(fx);
  const nm = el("span", "nm", baseName(R.repo));
  const active = lanes.filter((w) => { const s = slotOf(w); return s && sessionActive(s.id); }).length;
  const waiting = lanes.filter((w) => slotOf(w)?.awaiting === "owner").length;
  nm.appendChild(el("span", "cnt", `${lanes.length} ${lanes.length === 1 ? "Zweig" : "Zweige"}`
    + (isOpen ? "" : [active ? ` · ${active} arbeitet` : "", waiting ? ` · ${waiting} wartet auf dich` : ""].join(""))));
  head.appendChild(nm);
  const rt = el("span", "rt");
  // WHERE IT COMES FROM: the repo's remotes as the local refs know them (no fetch, no network)
  const pst = primary ? standOf.get(`worktree:${primary.path}`) : undefined;
  if (pst?.remote === "none") {
    const tag = el("span", "tag", "kein Remote");
    tag.title = "Dieses Repo hat keinen Remote — ein eigener Zustand, kein Fehler";
    tag.dataset.remote = "none";
    rt.appendChild(tag);
  } else if (Array.isArray(pst?.remote) && pst.remote.length) {
    const r0 = pst.remote[0];
    const d = r0.distance;
    const tag = el("span", "tag", `${r0.name ?? ""}${d ? `${d.ahead ? ` ↑${d.ahead}` : ""}${d.behind ? ` ↓${d.behind}` : ""}` : ""}`);
    tag.dataset.remote = r0.name ?? "";
    tag.title = pst.remote.map((r) => `${r.ref === null ? "unbekannt" : refShort(r.ref)}: ${r.head ? sha7(r.head) : "kein lokales Abbild"}`
      + (r.distance ? ` · ${r.distance.ahead} vor, ${r.distance.behind} hinter` : "")
      + (r.refAgeMs !== null ? ` · zuletzt abgeglichen ${agoDe(r.refAgeMs)}` : "")).join("\n")
      + "\n— aus den lokalen Abbildern, ohne Netz";
    rt.appendChild(tag);
  }
  const add = el("button", "rk-btn quiet ib") as HTMLButtonElement;
  add.type = "button";
  add.appendChild(icon("plus"));
  add.title = "Neue Lane in diesem Repo — Name, Profil und Kontext im Gründungsfenster";
  add.setAttribute("aria-label", add.title);
  add.onclick = (e) => { e.stopPropagation(); openLaneFounding(R.repo); };
  rt.appendChild(add);
  head.appendChild(rt);
  head.title = `${R.repo} — ${isOpen ? "zuklappen" : "aufklappen"}`;
  rowTarget(head, () => {
    rankeRepos.set(R.repo, !isOpen);
    prefSet("fleet.ranke.repos", JSON.stringify(Object.fromEntries(rankeRepos)));
    void renderBoard();
  });
  head.setAttribute("aria-expanded", String(isOpen));
  g.appendChild(head);
  if (!isOpen) return g;
  if (R.worktrees === null) {
    g.appendChild(el("div", "bstate", `Die Worktrees dieses Repos konnten nicht gelesen werden — ${R.reasons.map((r) => r.reason).join(", ") || "ohne Grund"}.`));
    return g;
  }
  const rk = el("div", "rk");
  const focusSession = focusSlot ? fleet[focusSlot - 1] : undefined;
  const ownPath = focusSession?.worktree ? rows.find((w) => slotOf(w)?.id === focusSlot)?.path ?? null : null;
  const onOver = hasOverhaul ? lanes.filter((w) => targetOf(w) === "overhaul") : [];
  const onMain = lanes.filter((w) => !onOver.includes(w));
  const wantsHere = (list: WorkplaceRow[]) => list.filter((w) => w.target.landed !== "yes").length;
  const lands = (n: number) => {
    const t = el("span", "tgt", `${n} ${n === 1 ? "landet" : "landen"} hier`);
    t.title = `${n} ${n === 1 ? "Zweig will" : "Zweige wollen"} hierher landen`;
    return t;
  };
  // the stem: main, its tip, the sessions in the main checkout as addresses, its test instance
  const main = branchOf("main");
  const mainHere = !!focusSession?.cwd && !focusSession.worktree && (focusSession.repo ?? focusSession.cwd) === R.repo;
  const mrow = el("div", `zr base${mainHere ? " here path" : ownPath ? " path" : ""}`);
  mrow.dataset.id = `${R.repo}#main`;
  mrow.style.setProperty("--d", "0");
  mrow.appendChild(el("span", "nd"));
  mrow.appendChild(el("span", "nm", "main"));
  const mrt = el("span", "rt");
  const nMain = wantsHere(onMain) + (overhaul?.distance?.ahead ? 1 : 0);
  if (nMain) mrt.appendChild(lands(nMain));
  const msha = sha7(main?.head);
  mrt.appendChild(el("span", "mono", msha ?? "?"));
  if (!msha) (mrt.lastChild as HTMLElement).title = "Spitze von main nicht lesbar";
  const stemSession = (b: string) => { const w = stemWt.get(b); const s = w ? slotOf(w) : undefined; return s ? [s] : []; };
  for (const s of [...fleet.filter((x) => x.cwd && !x.worktree && (x.repo ?? x.cwd) === R.repo), ...stemSession("main")]) {
    const r = el("button", `ref${s.id === focusSlot ? " on" : ""}`, String(s.id)) as HTMLButtonElement;
    r.type = "button";
    r.style.setProperty("--proj-h", String(hue));
    r.title = `Zu Session ${s.id} · ${laneLabel(s)} im Haupt-Checkout springen`;
    r.onclick = (e) => { e.stopPropagation(); jumpTo(s.id); };
    mrt.appendChild(r);
  }
  mrow.appendChild(mrt);
  if (primary) mrow.appendChild(tiSquare(primary, false));
  rk.appendChild(mrow);
  const lines: HTMLElement[] = [];
  if (primary && rankeOpen === `ti:${primary.path}`) lines.push(tiLine(R.repo, primary, null, standOf));
  rk.append(...lines);
  const sortKey = (w: WorkplaceRow): string => {
    const s = slotOf(w);
    const ref = s ? bands.get(s.id) ?? String(s.id) : "";
    return s ? `0${ref.padStart(6, "0")}` : `1${w.branch ?? w.path}`;
  };
  // NO ROW WITHOUT A STATEMENT, NO TWO ROWS ALIKE: a worktree without a session shows the words of
  // its branch — a detached one first THAT it is detached (the phone cuts the end), then its
  // directory's words — and words two such rows would share lead with what tells them apart
  const words = new Map<string, string>();
  for (const w of lanes) if (!slotOf(w)) words.set(w.path, w.branch ? laneWords(w.branch) : `losgelöst · ${laneWords(baseName(w.path))}`);
  // the part that tells them apart goes FIRST (a narrow column cuts the end): the day the branch was
  // cut where the days differ, else its hex tail, else the commit it stands on
  const plain = new Map(words);
  for (const mine of new Set(plain.values())) {
    const alike = lanes.filter((w) => plain.get(w.path) === mine);
    if (alike.length < 2) continue;
    const days = alike.map((w) => (w.branch ? branchDay(w.branch) : null));
    const byDay = days.every((d) => d) && new Set(days).size === alike.length;
    alike.forEach((w, i) => words.set(w.path,
      `${byDay ? days[i] : (w.branch ? /[-_/]([0-9a-f]{4,})$/.exec(w.branch)?.[1] : null) ?? sha7(w.head) ?? w.path} · ${mine}`));
  }
  const fold = lanes.length > 12 && !rankeFoldOpen.has(R.repo) ? lanes.filter((w) => !slotOf(w)) : [];
  const branchRows = (list: WorkplaceRow[], d: number, parent: string) => {
    for (const w of [...list].filter((x) => !fold.includes(x)).sort((a, b) => sortKey(a).localeCompare(sortKey(b))))
      rk.append(...laneRow(R, w, slotOf(w), d, parent, focusSlot, bands, hue, standOf, wts, words.get(w.path)));
  };
  branchRows(onMain, 1, `${R.repo}#main`);
  if (hasOverhaul) {
    const orow = el("div", `zr base${ownPath && onOver.some((w) => w.path === ownPath) ? " path" : ""}`);
    orow.dataset.id = `${R.repo}#overhaul`;
    orow.dataset.p = `${R.repo}#main`;
    orow.style.setProperty("--d", "1");
    orow.appendChild(el("span", "nd"));
    orow.appendChild(el("span", "nm", "overhaul"));
    const ort = el("span", "rt");
    const nOver = wantsHere(onOver);
    if (nOver) ort.appendChild(lands(nOver));
    const d = overhaul?.distance;
    if (d) {
      const v = el("span", "", d.ahead || !d.behind ? `${d.ahead} vor main` : `${d.behind} hinter main`);
      v.title = `overhaul: ${d.ahead} Commits vor main, ${d.behind} hinter · Spitze ${sha7(overhaul?.head) ?? "unbekannt"}`;
      ort.appendChild(v);
    }
    // the tip's commit only where the column asks for stands — here the distance is the answer
    if (rankeMode === "stand" || !d) ort.appendChild(el("span", "mono", sha7(overhaul?.head) ?? "?"));
    const ow = stemWt.get("overhaul");
    const os = ow ? slotOf(ow) : undefined;
    if (os) {
      const r = el("button", `ref${os.id === focusSlot ? " on" : ""}`, bands.get(os.id) ?? String(os.id)) as HTMLButtonElement;
      r.type = "button";
      r.style.setProperty("--proj-h", String(hue));
      r.title = `Zu Session ${os.id} · ${laneLabel(os)} im Worktree auf overhaul springen`;
      r.onclick = (e) => { e.stopPropagation(); jumpTo(os.id); };
      ort.appendChild(r);
    }
    orow.appendChild(ort);
    rk.appendChild(orow);
    if (ow) {
      orow.appendChild(tiSquare(ow, os?.id === focusSlot));
      orow.title = `overhaul · ausgecheckt in ${ow.path}${os ? "" : " — Klick zeigt Öffnen und Schließen"}`;
      const open = !os && rankeOpen === `wt:${ow.path}`;
      if (!os) {
        rowTarget(orow, () => { rankeOpen = open ? null : `wt:${ow.path}`; void renderBoard(); });
        orow.setAttribute("aria-expanded", String(open));
        orow.classList.toggle("open", open);
        orow.style.cursor = "pointer";
      }
      if (open) rk.append(...wtLines(R, ow, wts));
      if (rankeOpen === `ti:${ow.path}`) rk.appendChild(tiLine(R.repo, ow, os ? os.id : null, standOf));
    }
    branchRows(onOver, 2, `${R.repo}#overhaul`);
  }
  if (fold.length) {
    const f = el("div", "zr zf");
    f.dataset.id = `${R.repo}#fold`;
    f.dataset.p = hasOverhaul ? `${R.repo}#overhaul` : `${R.repo}#main`;
    f.style.setProperty("--d", hasOverhaul ? "2" : "1");
    f.append(el("span", "nd leer"), el("span", ""), el("span", "nm leer", `${fold.length} ohne Session`));
    const chev = el("span", "fc");
    chev.appendChild(icon("chevron"));
    f.appendChild(chev);
    f.title = "Worktrees ohne Session aufklappen";
    rowTarget(f, () => { rankeFoldOpen.add(R.repo); void renderBoard(); });
    rk.appendChild(f);
  }
  g.appendChild(rk);
  return g;
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
  tx.appendChild(el("span", "mono", w.branch ?? "losgelöst"));
  const wr = wts && wts.repo === R.repo ? wts.worktrees.find((x) => x.path === w.path) : undefined;
  tx.appendChild(document.createTextNode(` · ↑${w.distance?.ahead ?? "?"}${wr ? ` · ${wr.dirty ? `${wr.dirty} ungesichert` : "nichts ungesichert"}` : ""}`));
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
    const ob = el("button", "rk-btn primary", "Öffnen") as HTMLButtonElement;
    ob.title = "Diesen Worktree in einem freien Slot öffnen und dorthin springen";
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
    box.appendChild(el("div", "hint", "Schließen und die Notiz: in einer Session dieses Repos, dort steht, was verloren ginge."));
    out.push(box);
  }
  return out;
}

function laneRow(R: WorkplaceRepo, w: WorkplaceRow, s: SlotInfo | undefined, d: number, parent: string,
  focusSlot: number | null, bands: Map<number, string>, hue: number, standOf: Map<string, WorkplaceStand>,
  wts: WtInfo | null, words?: string): HTMLElement[] {
  const here = !!s && s.id === focusSlot;
  const ref = s ? bands.get(s.id) ?? String(s.id) : "";
  const working = !!s && sessionActive(s.id);
  const broken = !!s && (s.stalled || s.agent === "no-agent" || s.agent === "no-pane");
  const node = !s ? "leer" : broken ? "bad" : s.awaiting === "owner" ? "wait" : working ? "live" : "";
  const word = !s ? "kein Gespräch in diesem Worktree" : broken ? "hängt"
    : s.awaiting === "owner" ? "wartet auf dich" : s.awaiting === "main" ? "wartet auf MAIN"
    : working ? "arbeitet" : s.lastOutput > 0 ? `still seit ${agoDe(Date.now() - s.lastOutput).replace(/^vor /, "")}` : "still";
  const open = !s && rankeOpen === `wt:${w.path}`;
  const flash = rankeFlash && rankeFlash.path === w.path && rankeFlash.until > Date.now();
  const row = el("div", `zr zw${here ? " here path" : ""}${open ? " open" : ""}${flash ? " flash" : ""}`);
  row.dataset.id = w.path;
  row.dataset.p = parent;
  row.dataset.node = node || "still";
  if (s) row.dataset.slot = String(s.id);
  row.style.setProperty("--d", String(d));
  const stand = standOf.get(`worktree:${w.path}`);
  const headSha = sha7(w.head) ?? sha7(stand?.head);
  let name: HTMLElement;
  if (rankeMode === "branch") {
    name = el("span", "nm mono br", w.branch ?? "losgelöst");
  } else if (rankeMode === "stand") {
    name = el("span", "nm mono st");
    name.appendChild(document.createTextNode(headSha ?? "unbekannt"));
    const dist = w.distance;
    if (dist?.behind) name.appendChild(el("span", "q", ` ↓${dist.behind}`));
  } else {
    // without a session the ring of the node says so; the words of the branch tell such worktrees apart
    name = el("span", `nm${s ? "" : " leer"}`, s ? laneLabel(s) : words ?? laneWords(w.branch));
  }
  rowCells(row, node, ref, hue, name);
  const up = el("span", "up", `${w.distance?.ahead ? `↑${w.distance.ahead}` : ""}${s?.git?.dirty ? ` •${s.git.dirty}` : ""}`.trim());
  up.title = [w.distance ? `${w.distance.ahead} Commits vor ${w.base?.branch ?? "der Basis"}, ${w.distance.behind} hinter` : "Abstand zur Basis unbekannt",
    s?.git ? `${s.git.dirty} ungesicherte Dateien` : ""].filter(Boolean).join(" · ");
  row.appendChild(up);
  row.appendChild(checkBeads(w));
  row.appendChild(tiSquare(w, here));
  const where = `${w.branch ?? "losgelöst, auf keinem Zweig"} · läuft auf ${headSha ?? "unbekannt"}${w.target ? ` · landet in ${w.target.branch}` : ""}`;
  row.title = !s ? `Kein Gespräch in diesem Worktree · ${where} — Klick zeigt Öffnen und Schließen`
    : here ? `${ref} · ${laneLabel(s)} · ${word} — diese Session · ${where}`
    : `${ref} · ${laneLabel(s)} · ${word} — Klick springt hin wie in der Leiste · ${where}`;
  if (s && !here) rowTarget(row, () => jumpTo(s.id));
  else if (!s) {
    rowTarget(row, () => { rankeOpen = open ? null : `wt:${w.path}`; void renderBoard(); });
    row.setAttribute("aria-expanded", String(open));
  }
  const out: HTMLElement[] = [row];
  if (open) out.push(...wtLines(R, w, wts));
  if (rankeOpen === `ti:${w.path}`) out.push(tiLine(R.repo, w, s ? s.id : null, standOf));
  return out;
}

// The Ranke's lines: only vertical in the parent's column and horizontal to the node, 1 px. The own
// path (main → overhaul → the focused lane) in ink, everything else in the quiet edge. Drawn after
// the column is in the document, since it needs the rows' positions.
export function drawRankeLines(root: HTMLElement): void {
  for (const rk of root.querySelectorAll<HTMLElement>(".rk")) {
    rk.querySelector(":scope > svg")?.remove();
    const tb = rk.getBoundingClientRect();
    if (!tb.height) continue;
    const mid = (row: Element): [number, number] | null => {
      const n = row.querySelector(":scope > .nd")?.getBoundingClientRect();
      return n ? [Math.round(n.left + n.width / 2 - tb.left) + 0.5, Math.round(n.top + n.height / 2 - tb.top)] : null;
    };
    let quiet = "", ink = "";
    for (const row of rk.querySelectorAll<HTMLElement>(":scope > .zr[data-p]")) {
      const par = [...rk.querySelectorAll<HTMLElement>(":scope > .zr[data-id]")].find((x) => x.dataset.id === row.dataset.p);
      const a = par ? mid(par) : null, b = mid(row);
      if (!a || !b) continue;
      const d = `M${a[0]} ${a[1] + 4}V${b[1]}H${b[0] - 4}`;
      if (row.classList.contains("path") && par!.classList.contains("path")) ink += d; else quiet += d;
    }
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("aria-hidden", "true");
    for (const [d, cls] of [[quiet, "q"], [ink, "i"]] as const) {
      if (!d) continue;
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", d);
      p.setAttribute("class", cls);
      svg.appendChild(p);
    }
    rk.prepend(svg);
  }
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
// (owner 2026-10-07). Ack (PLA_ACK_KEY) and the adjudicate paths (undo-land, suite.log) stay.
export let postLandAudit: PostLandAuditInfo | null = null;
export let plaCard: HTMLElement | null = null;

// The OWNER WORDS, built from the structured payload (proportional / remoteReason /
// remoteTimeoutMs) rather than from the classifier's sentences: src/plaudit.ts decides WHETHER an
// alarm exists and its tone (green is silent, red ≠ unknown — e2e/outcomes.ts runs it directly),
// this surface decides how it reads. The red split is the classifier's own: since 2026-09-04 a
// docs-only tip is audited by the short proportional chain, and calling that "the full suite"
// would send the reader to the wrong log and the wrong repair.
export function plaOwnerHeadline(a: PostLandAuditInfo, tone: "red" | "unknown"): string {
  if (tone === "red") return "Der Check nach dem Land ist rot";
  if (a.remoteReason === "timeout") return "Der Check nach dem Land wurde abgebrochen";
  if (a.remoteReason === "could-not-start") return "Der Check nach dem Land konnte nicht starten";
  return "Der Check nach dem Land hat nichts gemessen";
}
// the sentence under the headline: WHICH tip, after WHICH land, and what this means — red names the
// short chain of a docs-only tip apart from the full one, unknown says why there is no verdict
export function plaOwnerLine(a: PostLandAuditInfo, tone: "red" | "unknown"): string {
  const tip = `${a.main ?? "main"}@${a.mainSha?.slice(0, 8) || "?"}`;
  const after = a.covers?.length ? ` nach dem Land von ${a.covers.map((b) => laneNameOfBranch(b)).join(", ")}` : "";
  if (tone === "red") return a.proportional
    ? `${tip} ist${after} rot — die kurze Kette für reine Doku-Stände scheitert. Rücknehmen oder reparieren.`
    : `${tip} ist${after} rot — die ganze Prüfung scheitert. Rücknehmen oder reparieren.`;
  const s = a.remoteReason === "timeout" && a.remoteTimeoutMs ? ` nach ${Math.round(a.remoteTimeoutMs / 1000)} s` : "";
  return a.remoteReason === "timeout" ? `Auf dem Helfer${s} beendet — für ${tip}${after} gibt es kein Urteil.`
    : a.remoteReason === "could-not-start" ? `Sie lief auf dem Helfer nie an — für ${tip}${after} gibt es kein Urteil.`
    : `Für ${tip}${after} gibt es kein Urteil.`;
}
// the consequence, opened by "Ansehen": what this means for the reader, and the ways back out
export function plaOwnerNote(tone: "red" | "unknown"): string {
  return tone === "red"
    ? "Nichts wurde blockiert, nichts zurückgenommen. „Undo last land“ (im ⋯ neben Land lane einer Lane) nimmt die neuesten Lands zurück, eines je Druck, höchstens 3 tief — welches es kaputt gemacht hat, findest du selbst."
    : "Ein Check, der nicht lief, ist kein Bestehen. An diesem Land ist nichts gemessen.";
}

// ONE BUILDER FOR BOTH SURFACES. Green is silent and an ack is keyed to THIS audit (PLA_ACK_KEY,
// src/plaudit.ts — the module under test); the receipt card is what an ack leaves behind, and its
// "show again" is the return path the dismissal never had (grammatik G5.1, card K7). The card is the
// draft's (rechter-tab-notiz.md §4a `alarm`, G2.1): in the flow, tinted, a signal edge at the bottom —
// the headline, one sentence, "Ansehen" for the detail and the log, "Gesehen" to acknowledge.
let plaOpen = false;
export function plaAlarmCard(): HTMLElement | null {
  const al = postLandAlarm(postLandAudit, prefNumber(PLA_ACK_KEY));
  if (!al) { plaCard = null; return null; }
  const a = postLandAudit!;
  const sec = el("div", `plasec ${al.tone}`);
  sec.appendChild(el("div", "plat", plaOwnerHeadline(a, al.tone)));
  sec.appendChild(el("div", "plad", plaOwnerLine(a, al.tone)));
  const acts = el("div", "plaacts");
  const look = el("button", "plaack", plaOpen ? "Weniger" : "Ansehen") as HTMLButtonElement;
  look.setAttribute("aria-expanded", String(plaOpen));
  look.title = "Wo, wann, was jetzt — und das ganze Protokoll, wenn der Helfer eines hochgeladen hat";
  look.onclick = () => { plaOpen = !plaOpen; renderPostLandAudit(); };
  const ack = el("button", "plaack quiet", "Gesehen") as HTMLButtonElement;
  ack.title = "Blendet diese Meldung aus — nur für diesen Prüflauf; die nächste nicht-grüne Prüfung meldet sich wieder.";
  ack.onclick = () => {
    prefSet(PLA_ACK_KEY, String(postLandAudit?.at ?? 0));
    renderPostLandAudit();
  };
  acts.append(look, ack);
  sec.appendChild(acts);
  if (plaOpen) {
    const detail = el("div", "pladetail");
    // where, in owner words: which repo, which tip, after which lands (the classifier's own line,
    // src/plaudit.ts#postLandAlarm, stays the hover — it names the full path)
    const wh = el("div", "plawhere", [baseName(a.repo ?? "") || "Repo nicht aufgezeichnet", `${a.main ?? "main"}@${a.mainSha?.slice(0, 8) || "?"}`,
      a.covers?.length ? `nach ${a.covers.map((b) => laneNameOfBranch(b)).join(", ")}` : "welches Land davor lag, ist nicht aufgezeichnet",
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
      const lg = el("a", "plalog", `Protokoll · ${Math.max(1, Math.round(art.bytes / 1024))} KB`) as HTMLAnchorElement;
      lg.href = art.url;
      lg.target = "_blank";
      lg.rel = "noopener";
      lg.title = `Das ganze Protokoll, das der Helfer nach diesem Urteil hochgeladen hat, ${art.bytes} Bytes,`
        + ` sha256 ${art.sha256.slice(0, 12)}…. Es kam NACH der Zeile und ist von der Seite her verbunden — am Ergebnis oben ändert es nichts.`;
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
  if (!a || a.result === "green") return null;
  if (prefNumber(PLA_ACK_KEY) !== a.at) return null;
  const sec = el("div", "plasec seen");
  sec.appendChild(el("div", "hint planote",
    `Der ${a.result === "red" ? "rote" : "ungemessene"} Check nach dem letzten Land (${fmtTs(a.at)}) ist als gesehen markiert`));
  const back = el("button", "plaack", "wieder zeigen") as HTMLButtonElement;
  back.title = "zeigt die Meldung wieder, die du als gesehen markiert hattest.";
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
  // and that repaint must not yank the reading position just for it
  const had = plaCard?.isConnected ? plaCard : null;
  const card = plaBoardCard();
  if (had) { if (card) had.replaceWith(card); else had.remove(); }
  else if (card && boardOpen) void renderBoard();
}

export function initBoard(): void {
  $("boardclose").onclick = () => setBoard(false);
  applyBoard();
}

export function setMeterOpen(value: boolean): void { meterOpen = value; }
export function setPostLandAudit(value: PostLandAuditInfo | null): void { postLandAudit = value; }
export function setGateInfo(value: GateInfo | null): void { gateInfo = value; }
export function setPostLandLive(value: PostLandAuditLiveInfo | null): void { postLandLive = value; }
export function setErrorsInfo(value: ErrorsInfo | null): void { errorsInfo = value; }
export function setMeterSuites(value: SuiteOfferRow[]): void { meterSuites = value; }
export function setDeployGapInfo(value: DeployGapInfo | null): void { deployGapInfo = value; }
export function setBundleStaleInfo(value: BundleStaleInfo | null): void { bundleStaleInfo = value; }
