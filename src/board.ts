import { $, el, RECENT_MS, SlotInfo, TEntry, WorktreeInfo, api, autosList, baseName, closeFxMenu, copyText, fleet, fmtDur, fmtTs, focused, fxAsked, fxGit, fxInputEl, fxMenu, fxOpenSet, fxQuery, fxRestoreAfterPaint, fxScroll, fxSearchInput, fxStartDrag, fxTree, fxTreeOf, fxView, instanceLinks, instanceName, isMobile, landsEnabled, laneBandNames, loadTree, openActivity, openAkte, openDiff, openExplorer, openExportDlg, openMergeDiff, openPacks, openReview, openShareDlg, paintTree, panes, post, refresh, rememberShas, renderDiffInto, reviewBody, serverNow, showSlot, slotsEl, stacksOf, startRename } from "./client";
import { openQueue, programsPoll } from "./queue";
import { prefBool, prefJSON, prefNumber, prefSet, prefSetBool } from "./prefs";
import { popover } from "./popover";
import { openLaneFounding } from "./founding";
import { askRisk } from "./dialog";
import { Shell, openShell } from "./shell";
import { PostLandAuditInfo, PostLandAuditLiveInfo, SuiteOfferRow } from "./protocol";
import { METER_STATIONS, MeterBall, MeterStation, laneTail, meterKind, meterLine, mmss, suiteMeter } from "./suitemeter";
import { PLA_ACK_KEY, postLandAlarm } from "./plaudit";
import { porcelainPath } from "./gitpath";
import { icon } from "./icons";
import { devbtn, deviceOnlineMs, devicesSection, helperDevicesInfo } from "./devices";
import { serverClock } from "./composer";

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
export interface BriefSuccession {
  rail: "lane" | "standard-main" | "game-maker-main" | "handoff";
  fill: { usedTokens: number; windowTokens: number; pct: number } | null;
  thresholdPct: number | null;
  thresholdOff: "steward" | "waiting" | "unpinned" | "harness" | "fleet" | "rail" | null;
  nudges: number; nudgedAt: number | null; gaveUp: boolean; maxNudges: number;
  session: number; taken: number | null; cap: number | null;
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
// the head's ⋯ session menu — module state for the same reason: the 3s repaint must not shut it.
// Bound to the SLOT it was opened on: it used to stay open across a focus change, offering one
// session's share/export/rename under another session's name.
export let boardMenuOpen = false;
export let boardMenuSlot: number | null = null;
// The board and Explorer action menus cannot be open on the same visible surface. They therefore
// share this K5 registration instead of adding another document-level outside-click listener.
// Both rebuild their rows, so panel, trigger and rows are read at event time.
popover({
  panel: () => fxMenu?.panel ?? boardBody.querySelector<HTMLElement>(".bmenu"),
  trigger: () => fxMenu?.trigger ?? boardBody.querySelector<HTMLElement>(".bheadmenu.on"),
  isOpen: () => fxMenu !== null || boardMenuOpen,
  close: (refocus) => {
    if (fxMenu) { closeFxMenu(refocus); return; }
    boardMenuOpen = false;
    void renderBoard();
    if (refocus) requestAnimationFrame(() => boardBody.querySelector<HTMLElement>(".bheadmenu")?.focus());
  },
  rows: () => fxMenu ? [...fxMenu.panel.querySelectorAll<HTMLButtonElement>(".fxmenuitem")]
    : [...boardBody.querySelectorAll<HTMLButtonElement>(".bmenu .bmenuitem")],
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
  notepad?: string | null; review?: ReviewCandidateInfo | null; preview?: LanePreviewInfo | null; reviews?: CandidateReviewInfo[] | null }
// server.ts#CandidateReviewView — an owner-pressed advisory review of a candidate's stored head, bound
// to the patch it read; `stale` when the worktree now carries another patch (null = unreadable)
export interface CandidateReviewInfo { id: string; candidate: string; head: string; base: string; patchId: string;
  startedAt: number; at: number | null; state: "running" | "filed" | "failed"; why: string | null;
  model: string | null; scope: string; notes: string; raw: boolean | null; findings: ReviewFinding[];
  patchNow: string | null; stale: boolean | null }
// server.ts#LanePreviewView — the time-boxed isolated preview of a candidate's stored head; `url` only
// while it runs, `stale` when the lane's HEAD moved off that head (null = HEAD unreadable)
export interface LanePreviewInfo { id: string; candidate: string; branch: string; head: string;
  state: "starting" | "running" | "stopped" | "expired" | "failed"; url: string | null; startedAt: number;
  expiresAt: number; endedAt: number | null; why: string | null; laneHead: string | null; stale: boolean | null }
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
  const ownerName = lk?.owner?.slot === null ? "Fleet" : lk?.owner?.slot
    ? laneBandNames(stacksOf()).get(lk.owner.slot) ?? `Slot ${lk.owner.slot}` : "Fleet";
  const owner = `${ownerName} · ${lk?.owner?.branch ? laneTail(lk.owner.branch) : "Branch unbekannt"}`;
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
  head.title = state === "free" ? "Kein Check hält gerade die maschinenweite Sperre (intern: suite mutex)."
    : lk?.reason || lk?.effect
      ? `Grund: ${lk.reason ?? "unknown"}; Nächstes: ${lk.nextAction ?? "unknown"}; Wirkung: ${lk.effect ?? "unknown"} (intern: lock reason/nextAction/effect)`
    : state === "stale" ? "Nichts läuft — ein beendeter Check lässt sein Sperr-Verzeichnis absichtlich zurück, der nächste räumt es weg (intern: stale lock)."
    : state === "overdue" ? "Der Halter lebt noch, hält aber viel länger als jeder Check auf dieser Maschine braucht — prüfe, ob er feststeckt (intern: overdue)."
    : "Die maschinenweite Sperre, von der Platte gelesen — Fleet liest nur, das Aufräumen eines toten Halters ist Sache der Wrapper (intern: suite mutex).";
  return head;
}

// --- the suite meter: the board's always-on thermometer over every suite in flight ---------------
// A slim tube pinned under the board head (public/index.html, #boardsuites), outside the scrolling
// body and drawn whether or not a session is focused. Each suite is a white ball riding the line
// through the tube, gathered at the station its run is at (src/suitemeter.ts says which rows land
// where); below the tube each ball is NAMED on a line of its own, and a name opens its lane. The station labels
// fold out the full gate reading (lock, running audit, reports) — the rows the meter summarises.
//
// The DOM is built once and updated in place, balls keyed by run: a ball that changes station keeps
// its element, so the CSS transition carries it along the tube instead of it blinking across.
export const meterEl = document.getElementById("boardsuites")!;
export const meterBalls = new Map<string, HTMLElement>();
export let meterSuites: SuiteOfferRow[] = [];
export let meterOpen = prefBool("fleet.meter.open");
export const METER_WORD: Record<MeterStation, string> = { wait: "waiting", run: "running", helper: "on helper", done: "done" };
// a finished ball says HOW it finished — the station alone would call a red run "done"
// WHAT IT IS DOING, which is not the same question as WHERE (the row's place column). A ball at
// `helper` is RUNNING — on the machine the place already names — so spelling "on helper" here said
// the place a second time in the narrowest column on the board. Four states, one of each kind:
// waiting, running, and the two ways a run can be over.
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
      letter: laneNames.get(s.id) ?? null })),
  });
}
export const METER_TITLE: Record<MeterStation, string> = {
  wait: "Angefragt, nicht gestartet — eine Lane wartet auf die Sperre, ein Angebot nahm noch kein Helfer, ein Land rollt in den nächsten Check ein (intern: suite mutex · post-land check).",
  run: "Läuft auf dieser Maschine — was gerade die maschinenweite Sperre hält (intern: suite mutex).",
  helper: "Läuft auf einem Helfer-Gerät — ein Check, den diese Maschine abgegeben hat (intern: suite offer).",
  done: "In den letzten Minuten beendet — grün, rot oder ohne Messung.",
};
export const METER_ROWS_MAX = 6;
export const meterTube = el("div", "smtube");
export const meterCols = el("div", "smcols");
export const meterRows = el("div", "smrows");
meterRows.id = "meter-runs";
export const meterHead = el("div", "smhead");
export const meterDetail = el("div", "smdetail");
{
  meterTube.append(el("div", "smbulb"), el("div", "smglass"), el("div", "smline"));
  METER_STATIONS.forEach((_, i) => {
    const t = el("div", "smtick");
    t.style.left = meterX(i, 0);
    meterTube.appendChild(t);
  });
  meterEl.append(meterHead, meterTube, meterCols, meterRows, meterDetail);
}
// the bulb is 14px; the four stations sit at the middles of four equal columns of the rest, the
// same grid .smcols lays the names out on — so a name stands under its own ball
export function meterX(i: number, offsetPx: number): string {
  return `calc(14px + (100% - 14px) * ${(i + 0.5) / METER_STATIONS.length} + ${offsetPx}px)`;
}
export function helperSummary(): string | null {
  if (!helperDevicesInfo.length || deviceOnlineMs === null) return null;
  const online = helperDevicesInfo.filter((d) => Date.now() - d.lastSeen < deviceOnlineMs!);
  if (!online.length) return "helpers offline";
  const free = online.reduce((n, d) => n + Math.max(0, (d.maxParallelSuites ?? 0) - (d.running ?? 0)), 0);
  const known = online.every((d) => d.maxParallelSuites !== undefined);
  return known ? `${free} helper slot${free === 1 ? "" : "s"} free` : `${online.length} helper${online.length === 1 ? "" : "s"} online`;
}
export function renderSuiteMeter() {
  if (!boardOpen) return; // mobile too: the meter renders into #boardsuites, which travels with #board
  const m = meterModel();
  const focusSlot = panes[focused]?.slot ?? null;
  meterEl.className = `lock-${m.lock ?? "none"}`;

  // head: one line — the title opens the full gate reading; then what the mutex is doing and for
  // how long; then what the helpers could still take
  const lk = gateInfo?.lock ?? null;
  const held = lk ? ` ${gateAge(lk.ageMs ?? lk.heldMs)}` : "";
  const lockWord = m.lock === null ? "not reported" : m.lock === "free" || m.lock === "stale" ? "idle"
    : m.lock === "overdue" ? `stuck${held}` : m.lock === "parked" ? `parked${held}` : m.lock === "unknown" ? `unknown holder${held}` : `busy${held}`;
  const lockEl = el("span", "smlock", lockWord);
  lockEl.title = m.lock === null ? "Dieser Server schickt keine Sperr-Lesung — hier hat nichts gemessen (intern: gate reading)."
    : m.lock === "overdue" ? "Der Lauf hält die Sperre länger als jeder Check hier braucht — er steckt vermutlich fest (intern: suite mutex)."
    : "Die maschinenweite Sperre — nur ein Check läuft gleichzeitig auf dieser Kiste (intern: suite mutex, e2e-stage.sh).";
  const hs = helperSummary();
  const devEl = hs ? el("button", "smdev", hs) as HTMLButtonElement : null;
  if (devEl) { devEl.title = "Helfer-Geräte — das Register öffnen"; devEl.onclick = () => devbtn.click(); }
  // …and the named end of that reach, drawn only when another instance exists to be confused with.
  // Owner words (G0.5, owner 2026-09-22): the badge is just the instance name; the German tooltip
  // says what it narrows — the numbers count this machine only, the other fleet is not in them.
  const elsewhere = instanceLinks.filter((l) => l.name !== instanceName);
  const scopeTag = el("span", "bscope", "fleet");
  scopeTag.title = "Diese Fleet: ihre maschinenweite Sperre, die Lanes auf dieser Kiste und die Helfer-Geräte, an die sie Arbeit verleiht (intern: suite mutex).";
  const scope = elsewhere.length ? el("span", "smscope", `${instanceName ?? "this machine"}`) : null;
  if (scope) scope.title = `${elsewhere.map((l) => l.name).join(", ")} `
    + `${elsewhere.length === 1 ? "ist eine eigene Fleet" : "sind eigene Fleets"} mit eigener Suite-Warteschlange. `
    + "Die Umschaltung kann sie öffnen, aber von hier aus wird keiner ihrer Läufe mitgezählt — eine leere Station hier sagt nichts über sie. "
    + "(intern: FLEET_INSTANCES ist eine Linkliste, kein Verbund).";
  const tog = el("button", `smtog${meterOpen ? " open" : ""}`) as HTMLButtonElement;
  tog.append(el("span", "bchev"), el("span", "smtitle", "Checks"));
  tog.setAttribute("aria-expanded", String(meterOpen));
  tog.setAttribute("aria-controls", "meter-runs");
  tog.title = meterOpen ? "Lesung zuklappen" : "Lesung aufklappen — Sperre, laufende Checks, jede Meldung (intern: gate reading)";
  tog.onclick = () => {
    meterOpen = !meterOpen;
    prefSetBool("fleet.meter.open", meterOpen);
    renderSuiteMeter();
  };
  meterHead.replaceChildren(tog, scopeTag, lockEl, ...(scope ? [scope] : []), ...(devEl ? [devEl] : []));

  // balls: keyed, so one run keeps its element while it moves from station to station
  const seen = new Set<string>();
  METER_STATIONS.forEach((st, i) => {
    const here = m.balls.filter((b) => b.station === st).sort((a, b) => a.at - b.at);
    here.forEach((b, j) => {
      seen.add(b.key);
      let ball = meterBalls.get(b.key);
      if (!ball) {
        ball = el("div", "smball entering");
        meterBalls.set(b.key, ball);
        meterTube.appendChild(ball);
        const born = ball;
        requestAnimationFrame(() => born.classList.remove("entering"));
      }
      // a crowd gathers: balls stack a few pixels apart, centred on the station
      ball.style.left = meterX(i, (j - (here.length - 1) / 2) * 9);
      // only the leading ball of a crowd trails a streak — the rest would draw theirs across it
      ball.className = `smball tone-${b.tone}${b.slot !== null && b.slot === focusSlot ? " mine" : ""}${j > 0 ? " tail" : ""}`;
      ball.title = `${b.name} — ${meterLine(b, serverClock()).join(" · ")}`;
    });
  });
  for (const [key, ball] of meterBalls) if (!seen.has(key)) { ball.remove(); meterBalls.delete(key); }

  // stations: the four labels, each under its tick, with a count
  meterCols.replaceChildren(el("div", "smcol0"), ...METER_STATIONS.map((st) => {
    const n = m.balls.filter((b) => b.station === st).length;
    const lab = el("button", `smst${n ? " on" : ""}`, METER_WORD[st]) as HTMLButtonElement;
    if (n) lab.appendChild(el("span", "smstn", String(n)));
    lab.title = METER_TITLE[st];
    lab.onclick = () => tog.click();
    return lab;
  }));
  // names: one full line per ball, in station order — a lane is NAMED, never cut to three letters
  // by a column a quarter of the board wide. A name opens its lane.
  const order = [...m.balls].sort((a, b) =>
    METER_STATIONS.indexOf(a.station) - METER_STATIONS.indexOf(b.station) || a.at - b.at);
  meterRows.replaceChildren(...(meterOpen ? [el("h3", "smsectiontitle", "Alle Prüfläufe")] : []),
    ...order.slice(0, meterOpen ? undefined : METER_ROWS_MAX).map((b) => {
    const mine = b.slot !== null && b.slot === focusSlot;
    const row = el("button", `smrow tone-${b.tone} st-${b.station}${mine ? " mine" : ""}`) as HTMLButtonElement;
    // NAME · WHAT · WHERE, and the row is CLASSED by its station. The state used to be a fourth
    // column, and it was the one thing this surface already said twice: the ball sits at its
    // station in the tube above, and the station label under it carries the count. Four columns in
    // ~267 px meant the LANE NAME was what got cut ("2 · ⎇ demo …"), which is the one thing the
    // rows exist for — "a lane is NAMED, never cut to three letters". So the state moved onto the
    // dot (hollow = waiting, filled = running, ringed = how it ended) and into the row's title,
    // and the place — the half a truncated row used to lose — took its column. (2026-09-20)
    // The middle column says BRANCH → STATE → CLOCK → KIND in one ellipsised span (src/suitemeter.ts#
    // meterLine), so a narrow board keeps the owner and wait relationship. The clock is
    // recomputed on this repaint (the /api/sessions poll), no timer of its own, on serverClock()
    // because `at` is the server's stamp.
    const line = meterLine(b, serverClock(), true).join(" · ");
    const name = b.kind === "post-land check" && b.slot === null ? "Fleet" : b.name;
    row.append(el("span", "smdot"), el("span", "smname", name), el("span", "smwhat", line),
      el("span", "smplace", b.where));
    row.title = `${name} — ${b.branch ?? "Branch unbekannt"} · ${line} · ${b.where} · ${meterState(b)} · ${meterKind(b.kind).title}`
      + (b.expect ? ` · „~“ ist der Median früherer Läufe dieser Art (n=${b.expect.n}), „länger als üblich“ heißt: über ihrem 90. Perzentil` : "")
      + (b.kind === "land check" ? " · Die Uhr zählt das Warten auf die maschinenweite Sperre mit (intern: suite mutex)" : "")
      + (b.slot !== null ? " · Klick öffnet die Lane" : "");
    const slot = b.slot;
    if (slot !== null && fleet[slot - 1]?.cwd) row.onclick = () => showSlot(slot);
    else row.disabled = true;
    return row;
  }), ...(!meterOpen && order.length > METER_ROWS_MAX ? [el("div", "smmore", `+${order.length - METER_ROWS_MAX} weitere — Checks öffnen`)] : []));

  const g = meterOpen ? gateSection() : null;
  meterDetail.replaceChildren(...(g ? [g] : meterOpen ? [el("div", "bempty", "Keine Lesung der Prüfsperre vorhanden")] : []));
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
export function deploySection(): HTMLElement | null {
  const codeDue = deployGapInfo?.codeBehind === true;
  const bundleDue = bundleStaleInfo?.stale === true;
  if (!codeDue && !bundleDue) return null;
  const sec = el("div", "bsec balert");
  // no title row of its own, so the reach rides the first line: this is the BOX, not the pane
  sec.appendChild(scopeTag("machine"));
  if (codeDue) {
    const n = deployGapInfo?.behindCount ?? null;
    const row = el("div", "bstate",
      `⚠ deploy due · the running server is ${n === null ? "behind HEAD" : `${n} commit${n === 1 ? "" : "s"} behind`} — restart it`);
    row.title = "Der laufende Server bootet von einem älteren Commit als HEAD, und der Unterschied berührt Server-Code — starte ihn neu, dann läuft dieser Baum (intern: gegen den COMMITTETEN Baum gemessen, nicht die Arbeitskopie).";
    sec.appendChild(row);
  }
  if (bundleDue) {
    const row = el("div", "bstate", "⚠ deploy due · the code in the browser is older than src/ — rebuild it");
    row.title = "Der Browser zeigt einen älteren Stand — im Terminal `bun run build` ausführen, dann ist er aktuell (intern: public/*.js sind gitignorierte Bauartefakte).";
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
  const sec = el("div", "bsec balert");
  sec.appendChild(scopeTag("machine"));
  const many = e.total !== e.distinct;
  // a BUTTON, not a clickable div: the error line is one of the column's actions (D-4 rest).
  // Inline rather than a new class: the stylesheet lives in public/index.html, which the demo repo
  // derives its own page from (CLAUDE.md) — and a lane cannot build that repo to check it. One
  // property here has no reach outside this file; a rule there has one nothing available can test.
  const head = el("button", "bstate",
    `⚠ ${e.total} server error${e.total === 1 ? "" : "s"}${many ? ` · ${e.distinct} distinct` : ""}`
    + ` · since ${fmtTs(e.since)}`) as HTMLButtonElement;
  head.style.cssText =
    "background:none;border:0;padding:0;width:100%;text-align:left;font:inherit;color:inherit;cursor:pointer;";
  head.title = "Thrown by the server since it booted. Held in memory only — a restart clears this list,"
    + " and server.log keeps the history. Click for the rows.";
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
  const saved = w.notepad ?? "";
  const box = el("div", "bnote");
  const ta = document.createElement("textarea") as HTMLTextAreaElement;
  ta.value = notepadDraft.get(w.path) ?? saved;
  ta.rows = 4;
  ta.placeholder = "Notiz zu diesem Worktree — wandert beim Parken und Weiterarbeiten mit";
  ta.style.cssText = "width:100%;box-sizing:border-box;resize:vertical;background:#101010;color:#c8c8c8;"
    + "border:1px solid var(--sel);border-radius:7px;padding:10px 12px;"
    + "font:12px ui-monospace,Menlo,Consolas,monospace;line-height:1.5;margin-top:6px;";
  const meta = el("div", "bstate");
  const err = el("div", "brefusal");
  const save = el("button", "bwtact", "Notiz sichern") as HTMLButtonElement;
  const sync = () => {
    const t = ta.value;
    notepadDraft.set(w.path, t);
    const over = t.length > WORKTREE_NOTE_MAX;
    meta.textContent = over
      ? `${t.length} / ${WORKTREE_NOTE_MAX} — über dem Deckel, kürzen (der Server nimmt nicht mehr an)`
      : `${t.length} / ${WORKTREE_NOTE_MAX}${t === saved ? " · gesichert" : " · ungesichert"}`;
    save.disabled = over || t === saved;
  };
  ta.addEventListener("input", sync);
  save.title = `sichert den Text an diesem Worktree-Pfad — er bleibt beim Parken, Wiederaufnehmen und über Neustarts erhalten`;
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
  box.append(ta, meta, save, err);
  sync();
  return box;
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
      // the deploy and error lines are about the MACHINE, not the focused lane — they must not
      // disappear just because the pane under the cursor is empty (the gate lives in the meter).
      const dp = deploySection();
      const er = errorsSection();
      // ...and so is the device register: which machines can take work is a fact about the room,
      // not about the empty pane.
      const dv = devicesSection();
      // the check alarm is about the MACHINE too — it shows even with no lane focused
      const pla0 = plaBoardCard();
      // the same scroll rescue the main path has: these three sections can be taller than the
      // column, and without it the machine zone jumped back to the top on every tick
      const y0 = boardBody.scrollTop;
      boardBody.replaceChildren(...(pla0 ? [pla0] : []), ...(dp ? [dp] : []), ...(er ? [er] : []),
        ...(dv ? [dv] : []), el("div", "bempty", "Focus a pane with a session to see its brief."));
      boardBody.scrollTop = y0;
      return;
    }
    const [briefRes, outlineRes, wtRes, mgRes] = await Promise.all([
      api(`/api/slots/${slot}/brief`), pollOutline(slot),
      s.git ? api(`/api/slots/${slot}/worktrees`) : Promise.resolve(null),
      s.worktree ? api(`/api/slots/${slot}/merge`) : Promise.resolve(null),
    ]);
    const { prompts, err: outlineErr } = outlineRes;
    const brief = briefRes.ok ? ((await briefRes.json()) as BriefInfo) : null;
    // the brief is one of the two places the board SEES commit shas — remember them so transcript
    // text citing a prefix of any of these can hover (the other source is fleet[].taskHead, live)
    if (brief) rememberShas(brief.head, ...(brief.commits ?? []).map((c) => c.hash),
      ...(brief.repoCommits ?? []).map((c) => c.hash));
    // WHY it is null, kept for the reader: a failed read used to remove Changes, History and Lanes
    // with no word at all, which is indistinguishable from a session that has done nothing.
    const briefErr = briefRes.ok ? null
      : ((await briefRes.json().catch(() => null)) as { error?: string } | null)?.error ?? `HTTP ${briefRes.status}`;
    const wts = wtRes?.ok ? ((await wtRes.json()) as WtInfo) : null;
    const wtErr = !wtRes || wtRes.ok ? null
      : ((await wtRes.json().catch(() => null)) as { error?: string } | null)?.error ?? `HTTP ${wtRes.status}`;
    const mg = mgRes?.ok ? ((await mgRes.json()) as MergeState) : null;
    if (mg?.running) mergeWatch.add(slot);
    const nodes: HTMLElement[] = [];
    const tools: HTMLElement[] = [];
    // the right board tells ONE story, top to bottom (owner, 2026-09-18/19): the MACHINE zone (the
    // suite meter above this body, then only alarms that are due) → the HEAD (who this session is,
    // what it is for, whom it waits on) → CHANGES (the one place with buttons) → CHECKS (this lane's
    // suites) → HISTORY → folded TOOLS. Every function of the old flat list is kept, only regrouped;
    // the context fill left because the sidebar row already carries it.

    // 0 — MACHINE: drawn only when due — the check alarm first (something failed ON MAIN, so it
    // outranks every question about the pane), then "is what you are looking at even the code that
    // is running", then "has that code been throwing". The gate lives in the meter; the helper
    // register behind the meter's device count and the 💻 dialog.
    const pla0 = plaBoardCard();
    if (pla0) nodes.push(pla0);
    const dsec0 = deploySection();
    if (dsec0) nodes.push(dsec0);
    const esec0 = errorsSection();
    if (esec0) nodes.push(esec0);

    // 1 — HEAD: the session's name, its state, what it is for, and its identifiers as chips. Rename,
    // Share and Export are VISIBLE at the head's foot as quiet word buttons (row 11e541e0; owner
    // 2026-09-22: „[Zitat entfernt]“
    // ) — quiet, not bordered, because four bordered buttons outweighed
    // everything the head is for. The rarer two (copy the worktree path, bring the session back)
    // stay behind ⋯. The phone reaches this head through ℹ, and its drawer row through ⋯.
    const idsec = el("div", "bsec bhead");
    const top = el("div", "bheadtop");
    top.appendChild(el("div", "bheadname", s.label ?? baseName(s.cwd)));
    top.appendChild(scopeTag("session"));
    const mbtn = el("button", `bheadmenu${boardMenuOpen ? " on" : ""}`, "⋯") as HTMLButtonElement;
    mbtn.title = "Weitere Aktionen — Worktree-Pfad kopieren, die Session zurückholen";
    mbtn.setAttribute("aria-expanded", String(boardMenuOpen));
    mbtn.onclick = () => { boardMenuOpen = !boardMenuOpen; boardMenuSlot = slot; void renderBoard(); };
    top.appendChild(mbtn);
    idsec.appendChild(top);
    {
      const working = sessionActive(slot);
      const meta = el("div", "bheadmeta");
      meta.appendChild(el("span", `bdot${working ? " on" : ""}`));
      // no context fill and no model here: the sidebar row carries both for every session at once,
      // and in the board they read as a second copy (owner, 2026-09-19 — „[Zitat entfernt]“
      // ). What the head adds is the one thing the row cannot: how long the
      // session has been quiet.
      const bits = [`${working ? "Working" : "Idle"} · ${brief?.worktree ? "lane" : "repo session"} in slot ${slot}`];
      if (!working && s.lastOutput > 0) bits.push(`quiet ${gateAge(Date.now() - s.lastOutput)}`);
      meta.appendChild(document.createTextNode(bits.join(" · ")));
      const since = brief?.sessionStart ?? s.openedAt ?? null;
      if (since) meta.title = `session since ${new Date(since).toLocaleString()}`;
      idsec.appendChild(meta);
    }
    // THE STATES THAT ONLY EXIST WHEN THEY ARE TRUE. Each is a sentence the owner would otherwise
    // have to go looking for; none of them costs a line on a healthy session.
    if (s.agent === "no-agent") {
      const a = el("div", "bwait owner", "No agent behind this pane");
      a.title = "the pane is alive and takes keystrokes, but nothing is running in it — typing here reaches no agent";
      idsec.appendChild(a);
    }
    if (s.stalled) {
      const st = el("div", "bwait main",
        s.stalledSince ? `Stalled for ${gateAge(Date.now() - s.stalledSince)}` : "Stalled");
      st.title = "no output, nothing waiting on an answer — the lane is standing still";
      idsec.appendChild(st);
    }
    if (s.autoCloseRefusal) {
      const r = el("div", "brefusal", s.autoCloseRefusal);
      r.title = "why the autoclose tick is leaving this lane open";
      idsec.appendChild(r);
    }
    if (s.awaiting) {
      const w = el("div", `bwait ${s.awaiting}`, s.awaiting === "owner" ? "Waiting on you" : "Waiting on its MAIN");
      w.title = s.awaiting === "owner"
        ? "This session has stopped until the owner answers — its latest message or an open attention says what it needs."
        : "This session has stopped until the MAIN that runs it answers.";
      idsec.appendChild(w);
    }
    if (s.mission) {
      const mi = el("div", "bmission", s.mission);
      mi.title = s.mission;
      idsec.appendChild(mi);
    }
    // THE SUCCESSION NUMBERS (owner, 2026-09-20: they belong in the identity block he signed off).
    // Four bare facts in the same label/value row form the setup block uses — no tile, no bar, no
    // second box: how full this session is, what happens at which percentage and whether it has
    // already been said, which exit the rail would name, and which session of this line holds the
    // pane. All four come from the BRIEF (server.ts#successionFacts), never from the poll row: the
    // row's ctx chip is the sidebar's job and a second copy of it is what the owner cut on
    // 2026-09-19. Here the fill is the number the threshold is compared against, and it is never
    // drawn without it.
    if (brief?.succession) {
      const sc = brief.succession;
      let nth = 0;
      const srow = (label: string, value: string, title: string) => {
        const r = el("div", `bsrow bsucc${nth++ === 0 ? " bsucctop" : ""}`);
        r.appendChild(el("span", "bskey", label));
        r.appendChild(el("span", "bsval", value));
        r.title = title;
        idsec.appendChild(r);
      };
      const tok = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`
        : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n);
      const clock = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      // an unmeasurable window is NEVER drawn as 0 % — a session Fleet cannot read and an empty one
      // are not the same session, and the whole rail hangs off this number
      srow("Fill", sc.fill
        ? `${tok(sc.fill.usedTokens)} / ${tok(sc.fill.windowTokens)} · ${Math.round(sc.fill.pct)} %`
        : "not measurable",
        sc.fill
          ? `${sc.fill.usedTokens} von ${sc.fill.windowTokens} Tokens im Fenster — gegen diese Zahl misst der Server, wann die Session weitergeben soll (intern: succession fill · threshold).`
          : "Fleet kann diesen Kontext nicht messen: keine gepinnte Konversation, noch kein Nutzungsrecord, kein benennbares Fenster — das ist kein leerer Kontext (intern: succession fill).");
      // threshold AND nudge on ONE line, because the second is only ever news about the first
      const offWhy: Record<NonNullable<BriefSuccession["thresholdOff"]>, string> = {
        fleet: "migration is not armed on this fleet",
        rail: "this kind's own threshold is 0",
        harness: `${s.harness ?? "this harness"} is not on the handover band`,
        steward: "the planning pane is not nudged",
        waiting: "this session waits on the owner",
        unpinned: "no pinned conversation to measure",
      };
      // the count and the budget live on the hover: the owner's form for this line is a bare fact
      // („[Zitat entfernt]“), and a second bracket made it wrap
      const nudge = sc.gaveUp ? `gave up after ${sc.nudges}`
        : sc.nudges === 0 ? "not nudged"
        : `nudged ${sc.nudgedAt ? clock(sc.nudgedAt) : "at an unrecorded time"}`;
      srow("Handover", sc.thresholdPct !== null ? `at ${sc.thresholdPct} % — ${nudge}`
        : `off — ${offWhy[sc.thresholdOff ?? "rail"]}`,
        sc.thresholdPct !== null
          ? `Bei ${sc.thresholdPct} % tippt der Server dieser Konversation selbstständig einen Weitergabe-Hinweis hinein — bisher ${sc.nudges} von höchstens ${sc.maxNudges}. Der Zähler lebt nur im Speicher des Servers: ein Neustart vergisst ihn (intern: succession nudge).`
          : "Nichts in diesem Server würde diese Session zum Weitergeben auffordern — von Hand geht es weiterhin (intern: succession routes).");
      // "Kind" — the MAIN-derived label (Slot 13, abgeleitet aus audit→check, Owner-Sichtung
      // offen): the row says WHICH kind of handover route this session has, so the values below
      // stay exactly as they are. "rail" itself must not be visible (G0.5).
      const railWhy: Record<BriefSuccession["rail"], string> = {
        lane: "Die Nachfolge ist eine frische Session auf DIESEM Worktree, gleichem Branch und Slot — committen, Handoff-Report filen, dann POST /api/self/succeed (intern: rail).",
        "standard-main": "Ein gebundener Program-MAIN gibt über den Programm-Eintrag weiter, den der Server ohnehin führt — kein Handoff-Commit nötig (intern: rail=standard-main).",
        "game-maker-main": "Der committete Abschnitt `## Current game checkpoint` in HANDOFF.md ist der einzige Weitergabe-Kanal (intern: rail=game-maker-main).",
        handoff: "Watches, Autos und Reports ziehen per Id mit; das Succeed nimmt einen Intent ODER einen committeten Zeiger, nie beides (intern: rail=handoff).",
      };
      srow("Kind", sc.rail, railWhy[sc.rail]);
      // the lid is keyed by the QUEUE ROW (originId), so a hand-opened lane has none to spend
      // owner words (G0.5, owner 2026-09-22): baton → handoff; action words stay English, only
      // the tooltip explains in German
      srow("Handoff", sc.cap !== null ? `Session ${sc.session} · ${sc.taken ?? 0} of ${sc.cap}`
        : sc.taken !== null ? `Session ${sc.session} · ${sc.taken} taken, no cap`
        : `Session ${sc.session} · no cap`,
        sc.cap !== null
          ? `Wie oft diese Aufgabe per Handoff in eine frische Session weiterlaufen darf: ${sc.cap}mal. Danach verweigert der Server das Weiterschicken und verlangt stattdessen einen Report (intern: FLEET_LANE_SUCCEED_MAX). Die Zählung hängt an der Aufgaben-Zeile — neu einreihen setzt sie nicht zurück.`
          : sc.rail === "lane"
            ? "Diese Lane trägt keine Aufgaben-Zeile, also begrenzt sie kein Handoff-Limit."
            : "Diese Session läuft auf einer Hauptroute ohne Handoff-Limit — nur Lanes mit Aufgaben-Zeile haben eins.");
    }
    // identifiers: machine strings in mono, each a chip — hover says what it is, a click does the one
    // thing it is for (copy a sha or a branch; open the queue on a task or a program)
    const chips = el("div", "bchips");
    const copyChip = (label: string, value: string, what: string) => {
      const c = el("button", "bchip", label) as HTMLButtonElement;
      c.title = `${what} — click to copy`;
      c.onclick = () => { copyText(value); c.textContent = "copied"; setTimeout(() => { c.textContent = label; }, 1100); };
      return c;
    };
    if (brief?.branch) chips.appendChild(copyChip(brief.branch, brief.branch, "branch"));
    if (brief?.head) chips.appendChild(copyChip(brief.head, brief.head, "HEAD commit"));
    if (s.taskId) {
      const c = el("button", "bchip link", `task ${s.taskId}`) as HTMLButtonElement;
      c.title = `${s.taskHead || "the order this session was started from"} — click to open the queue`;
      c.onclick = () => openQueue();
      chips.appendChild(c);
    }
    if (s.programId) {
      const p = programsPoll.find((x) => x.id === s.programId);
      const c = el("button", "bchip link", `program ${p?.title ? p.title.slice(0, 28) : s.programId.slice(0, 8)}`) as HTMLButtonElement;
      c.title = `${p?.title ?? s.programId} — click to open the queue`;
      c.onclick = () => openQueue();
      chips.appendChild(c);
    }
    if (brief?.worktree) {
      const branch = brief.worktree.branch;
      const c = el("button", "bchip link", "Akte") as HTMLButtonElement;
      c.title = "this lane end to end — its order, its prompts, its commits, its land";
      c.onclick = () => void openAkte(branch);
      chips.appendChild(c);
    }
    if (chips.childElementCount) idsec.appendChild(chips);
    {
      const sessName = s.label ?? baseName(s.cwd);
      const acts = el("div", "bbtnrow bheadacts");
      const act = (label: string, title: string, run: () => void) => {
        const b = el("button", "bbtn quiet", label) as HTMLButtonElement;
        b.title = title;
        b.onclick = run;
        acts.appendChild(b);
      };
      act("Rename", "Diese Session umbenennen — der Name steht dann in der Leiste.", () => {
        const row = slotsEl.querySelector(`[data-slot="${slot}"]`);
        if (row instanceof HTMLElement) startRename(row, s);
      });
      act(s.share ? "Shared — view only…" : "Share…", "Diese Session nur lesend teilen — ein Link mit Passwort.", () => openShareDlg(slot));
      act("Export…", "Die Session exportieren — Gespräch oder Bildschirm, du wählst Teile und Format.",
        () => { void openExportDlg(slot, sessName); });
      idsec.appendChild(acts);
    }
    if (boardMenuOpen && boardMenuSlot !== slot) boardMenuOpen = false; // it was another session's menu
    if (boardMenuOpen) {
      const menu = el("div", "bmenu");
      const item = (label: string, title: string, run: (b: HTMLButtonElement) => void) => {
        const b = el("button", "bmenuitem", label) as HTMLButtonElement;
        b.title = title;
        b.onclick = () => run(b);
        menu.appendChild(b);
      };
      if (brief?.worktree && s.cwd) {
        const cwd = s.cwd;
        item("Copy worktree path", cwd, (b) => { copyText(cwd); b.textContent = "Copied"; });
      }
      // bring session back — the repair for a pane that switched conversations on you. Claude Code
      // can change session IN-PROCESS: the pane keeps the argv it was spawned with, so nothing on
      // the outside can tell, and Escape does not undo it. A respawn does, because the slot still
      // holds the pinned sessionId and the server restarts the pane with --resume. There is no
      // deterministic signal for "this pane wandered off", so the owner decides, not a detector.
      item("Bring session back", "restart this pane and resume the pinned conversation — the slot keeps its lane, "
        + "label, model, shares and scheduled prompts. Whatever the session is doing RIGHT NOW is lost.", async (b) => {
        if (!(await askRisk({
          title: `Restart slot ${slot}'s pane and resume the pinned conversation?`,
          body: [el("div", "bmidrun",
            "Nothing about the slot is thrown away. But claude is killed, so anything it is doing "
            + "right now — a running tool call, unsent output — is lost.")],
          buttons: [
            { label: "cancel", value: false },
            { label: "restart", danger: true, value: true },
          ],
        }))) return;
        b.disabled = true;
        b.textContent = "Restarting…";
        const r = await post(`/api/slots/${slot}/restart`, {});
        const j = await r.json().catch(() => null) as { resumed?: boolean; error?: string } | null;
        if (!r.ok) { alert(j?.error ?? "restart failed"); b.disabled = false; b.textContent = "Bring session back"; return; }
        // "restarted fresh" means the pinned conversation could NOT be resumed (no pin, or its
        // transcript is gone) — the one outcome the owner must not mistake for success
        b.textContent = j?.resumed ? "Session back" : "Restarted fresh — the conversation could not be resumed";
        await refresh();
      });
      top.appendChild(menu); // the menu hangs at its ⋯ button (G4.1), not in the section's flow
    }
    nodes.push(idsec);

    // 1b — SETUP: what this session is MADE of, as opposed to what it has done (owner, 2026-09-19:
    // "das gewählte profil einer session anzeigen + ctxPacks … den aufbau der aktuellen session
    // ersichtlich machen"). Every row here was chosen when the session was founded and does not
    // move while it runs — which is exactly why the one number that DOES move (context fill) lives
    // in the head above and not here. Rows whose absence is the normal case (container, browser)
    // appear only when they are true; the founding four are always written, "—" included, so the
    // block reads the same on every session.
    {
      const su = el("div", "bsec bsetup");
      su.appendChild(boardHead("Setup", "session"));
      const row = (label: string, value: string, title?: string) => {
        const r = el("div", "bsrow");
        r.appendChild(el("span", "bskey", label));
        r.appendChild(el("span", "bsval", value));
        if (title) r.title = title;
        su.appendChild(r);
      };
      const setup = brief?.setup;
      // WHAT KIND OF SESSION THIS IS. The owner's seat for the session kinds still to come
      // (2026-09-19: „[Zitat entfernt]“
      // ). Until they exist, this row says only what is
      // actually true today and invents no kind: lane or repo session, plus a granted profile.
      // PROFILE — its own row, always written, because the owner reads it as a fact of the
      // session and not as a decoration of another line. It was invisible in every real session
      // until 2026-09-20: it was a suffix that only appeared for "game-maker", and the server
      // resolves it through `slot.programId`, which none of the ten live sessions carried.
      // Absence of a program bracket IS standard (server/types.ts: "Abwesenheit = Standard-MAIN"),
      // so absence is written as the answer it is, with the reason on hover.
      // "Program type" since the founding window (F4, owner 2026-09-24): „[Zitat entfernt]“ is now the
      // founding choice (harness/model/effort) in the Gründungsfenster's step 2, and the machine
      // profile of the PROGRAM needed a name that cannot be read as that choice.
      row("Program type", setup?.profile ?? "standard",
        setup?.profile === "game-maker" ? "the owner granted this session's program the game-maker profile"
          : setup?.profile === "standard" ? "this session's program runs on the standard profile"
          : "standard by default — this session has no program bracket to grant another profile");
      // THE KIND OF SESSION IS NOT REPEATED HERE. The head's own state line already reads
      // "lane in slot 2" / "repo session in slot 1", four rows further up the same column, and the
      // space cut of 2026-09-20 removed the second copy rather than a fact. The session kinds still
      // to come (fleetWorker, a session's own config) belong on that line too when they exist.
      // model, effort and the context budget are NOT repeated here: they are on the sidebar row
      // for every session at once, and the owner called them redundant in the board (2026-09-19).
      if (s.browser) row("Browser", "Playwright MCP", "this lane was started with the browser tool attached");
      if (s.container) row("Container", s.containerContext ? `${s.container} · ${s.containerContext}` : s.container,
        "the box and docker context this session's agent runs in");
      // THE PACKS, and where they come from. A receipt is what this pane actually received; the
      // program's declaration is the weaker answer and says so rather than passing for delivery.
      const packs = setup?.packs ?? [];
      if (packs.length) {
        const r = el("div", "bsrow bspacks");
        r.appendChild(el("span", "bskey", "Packs"));
        const list = el("span", "bsval");
        // every chip OPENS the pack — its pointers in full, and from there the source file itself
        // (owner, 2026-09-19: „[Zitat entfernt]“)
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
      }
      // no row for "no packs": a session without them is the ordinary case, and a row saying `none`
      // cost a line on every session to answer a question only a packed one raises. The hover on
      // the section's own head still says what the block is. (space cut, 2026-09-20)
      const since = brief?.sessionStart ?? s.openedAt ?? null;
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
      nodes.push(su);
    }

    // THE NOTEPAD — the owner's free text on THIS lane's worktree, directly above the suite area
    // (owner 2026-09-23: „[Zitat entfernt]“). Drawn from the lanes read alone, so it
    // stands even when the brief failed; a repo session (the primary checkout is no board row) and
    // a failed lanes read draw none.
    {
      const ownWt = wts?.worktrees.find((x) => x.path === s.cwd);
      if (ownWt && wts) {
        const noteSec = el("div", "bsec");
        noteSec.appendChild(boardHead("Notizblock", "repo"));
        noteSec.appendChild(notepadBlock(wts.repo, ownWt));
        nodes.push(noteSec);
      }
    }
    if (briefErr) {
      const fail = el("div", "bsec bfail");
      fail.appendChild(boardHead("Changes, history and lanes are missing", "session"));
      fail.appendChild(el("div", "bstate", `The session brief could not be read — ${briefErr}.`));
      fail.appendChild(el("div", "bempty", "This is a failed read, not an empty session. The column keeps "
        + "trying; if it persists, the session's working directory may be gone."));
      nodes.push(fail);
    }
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
      work.appendChild(boardHead("Changes", "session"));
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
        if (ahead) wl.appendChild(document.createTextNode(` · ${ahead} commit${ahead === 1 ? "" : "s"} ready`));
        work.appendChild(wl);
        // the concrete uncommitted work — exactly what git status shows, with its codes
        if (brief.uncommittedFiles.length) {
          const uf = el("div", "bunc");
          // every uncommitted file, not the first 40: the owner reads this list to decide what
          // to commit, and a silent cut is the one thing it must not do (2026-09-19). The server
          // caps the status read at 200 lines and says so below when it hit that cap.
          for (const f of brief.uncommittedFiles) {
            // porcelain XY: X = staged (index) column, Y = worktree (unstaged) column
            const x = f[0] ?? " ", y = f[1] ?? " ";
            const row = el("button", "buncf");
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
          // the list is complete unless the SERVER's own 200-line status cap cut it — say which
          // one it is, because "everything you changed" and "the first 200" are different claims
          if (brief.uncommitted > brief.uncommittedFiles.length)
            uf.appendChild(el("div", "bempty",
              `… ${brief.uncommitted - brief.uncommittedFiles.length} more — the server reads at most 200 status lines`));
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
          const q = el("button", "bbtn", busy === "quick" ? "Committing…" : "Commit") as HTMLButtonElement;
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
          const q = el("button", "bbtn", busy === "quick" ? "Committing…" : "Commit") as HTMLButtonElement;
          q.disabled = !!busy;
          q.title = "stage & commit tracked changes only (git add -u); untracked files left alone — undo with git reset. Shows a preview first.";
          q.onclick = () => void doCommitMain(slot, "quick", files);
          const a = el("button", "bbtn quiet", busy === "agent" ? "Writing message…" : "Commit with written message") as HTMLButtonElement;
          a.disabled = !!busy;
          a.title = "same commit, but a short-lived agent writes a conventional-commit message from the staged diff first";
          a.onclick = () => void doCommitMain(slot, "agent", files);
          crow.append(q, a);
          work.appendChild(crow);
        }
      } else if (ahead) {
        work.appendChild(el("div", "hint bnote ready",
          `${ahead} commit${ahead === 1 ? "" : "s"} ready to ${brief.worktree ? "land" : "push"}`));
      } else {
        work.appendChild(el("div", "hint bnote", "Nothing uncommitted, nothing ahead."));
        if (!brief.worktree) {
          const db = el("button", "bbtn quiet", "View diff") as HTMLButtonElement;
          db.onclick = () => void openDiff(slot);
          work.appendChild(db);
        }
      }
      // BEHIND — and, on a lane, the one action that fixes it. The button carries the number, so
      // there is never a count without a way to act on it and never an action without its reason;
      // at behind 0 there is no button at all, only the state (owner, 2026-09-20).
      const baseName_ = brief.laneBase ?? "main";
      // BEHIND, and on a lane the one action that fixes it. The button carries the count, so there
      // is never a number without a way to act on it and never an action without its reason; at
      // behind 0 there is no button at all. It is built here (where the count is) and placed with
      // the other lane verbs below (owner, 2026-09-20: „[Zitat entfernt]“).
      let rebaseBtn: HTMLButtonElement | null = null;
      if (behind && brief.laneScoped) {
        if (brief.worktree) {
          rebaseBtn = el("button", "bbtn quiet",
            rebaseBusy.has(slot) ? "Rebasing…" : `Rebase — ${behind} behind ${baseName_}`) as HTMLButtonElement;
          rebaseBtn.disabled = rebaseBusy.has(slot);
          rebaseBtn.title = `replay this lane's commits on top of ${baseName_}. It ONLY rebases: it does not verify `
            + "and it does not land, and on a conflict it aborts and leaves the lane exactly as it is.";
          rebaseBtn.onclick = () => void doRebase(slot);
        } else {
          work.appendChild(el("div", "hint bnote", `${behind} commit${behind === 1 ? "" : "s"} behind ${baseName_}`));
        }
      }
      // …and what the last rebase did, which outlives the count it removed: a rebase that WORKED
      // deletes the very number that explained the button, so without this line the column would
      // look as if nothing had happened.
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
      if (rbNote && !brief.worktree) work.appendChild(rbNote);
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
          const lb = el("button", "bbtn" + (ahead && !mg?.running && !awaitingReview ? " primary" : ""),
            mg?.running ? "Landing…" : awaitingReview ? "Re-run merge" : "Land lane") as HTMLButtonElement;
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
        const shb = el("button", "bbtn quiet", "Shelve") as HTMLButtonElement;
        shb.disabled = !!mg?.running;
        shb.title = "set this lane aside with a note (what's left) — kills the slot, keeps the worktree to resume later; nothing lost, nothing destroyed";
        shb.onclick = () => void doShelve(slot);
        land.appendChild(shb);
        const pkb = el("button", "bbtn quiet", "Park for review") as HTMLButtonElement;
        pkb.disabled = !!mg?.running;
        pkb.title = "park this finished lane for a later review — frees the slot, keeps worktree, task ids, head, base and the accepted report; the tasks do not start again, reopening binds them back (verify then counts as stale)";
        pkb.onclick = () => void doShelve(slot, true);
        land.appendChild(pkb);
        // ↻ rebase sits with the other lane verbs, because it is one: it moves this lane, and the
        // reader decides between "land it" and "bring it up to date" in one place.
        if (rebaseBtn) land.appendChild(rebaseBtn);
        // ↩ undo last land — only when the server still holds an undoable land for THIS repo
        // (main not moved since, not pushed). Reverses the one action that mutates main.
        if (mg?.undoable && brief.worktree.repo) {
          const ub = el("button", "bbtn quiet", `Undo last land (${laneTail(mg.undoable.branch)})`) as HTMLButtonElement;
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
          const rev = el("button", "bmergereview", "Review diff") as HTMLButtonElement;
          rev.onclick = () => void openMergeDiff(slot);
          acts.append(rev);
          // reviewing a carried-over verdict stays available on a follower; confirming it does not.
          if (landsEnabled) {
            const landb = el("button", "bmergeland", "Land") as HTMLButtonElement;
            landb.onclick = () => void doMergeLand(slot);
            acts.append(landb);
          }
          note.appendChild(acts);
          land.appendChild(note);
        } else if (l && failedLandVerdict(l)) {
          const note = el("details", `bmergenote ${l.status === "blocked" ? "warn" : "err"} landalarm`);
          const alarmKey = `${l.branch}:${l.at}`;
          (note as HTMLDetailsElement).open = landAlarmOpens.has(alarmKey);
          note.addEventListener("toggle", () => {
            if ((note as HTMLDetailsElement).open) landAlarmOpens.add(alarmKey);
            else landAlarmOpens.delete(alarmKey);
          });
          const kind = l.status === "blocked" ? "Land blockiert" : l.status === "interrupted" ? "Land unterbrochen" : "Land fehlgeschlagen";
          note.appendChild(el("summary", "", `${kind} · ${laneTail(l.branch)}`));
          note.appendChild(el("div", "bmergedetail", l.detail));
          note.appendChild(verifyBadge(l.verify));
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
        if (rbNote) work.appendChild(rbNote);
      }
      nodes.push(work);

      // CHECKS: this session's own suites, read off the same model the meter draws — every ball whose
      // slot is this one. The land's own verify verdict stays with the land above, where it decides.
      {
        const mine = meterModel().balls.filter((b) => b.slot === slot);
        // NO SUITE, NO SECTION (space cut, 2026-09-20). The sentence this used to draw — "No suite
        // reported in the last few minutes" — cost a headed section on every session that is not
        // running one, which is most of them most of the time, and the meter above is the always-on
        // answer to the same question for the WHOLE fleet. What is kept is the half the meter cannot
        // guarantee: the meter is capped at six rows, so this section is where THIS session's own
        // runs are certain to be readable.
        const ck = el("div", "bsec");
        ck.appendChild(boardHead("Checks", "session"));
        for (const b of mine) {
          const row = el("div", `bcheck tone-${b.tone}`);
          // a land still before its first suite has no stage yet — its kind word stands in
          row.append(el("span", "smdot"), el("span", "bcheckwhat", b.what || b.kind), el("span", "bcheckstate", meterState(b)));
          // serverClock(), not Date.now(): `b.at` is the SERVER's stamp, and this pane's clock
          // may sit minutes away from it — the same correction every other age here uses
          if (b.at > 0) row.appendChild(el("span", "bcheckage", gateAge(serverClock() - b.at)));
          row.title = `${b.what || b.kind} — ${meterState(b)}`;
          ck.appendChild(row);
        }
        if (mine.length) nodes.push(ck);
      }

      // 3 — COMMITS: the history, and deliberately TWO lists ("[Zitat entfernt]", owner §F4) — what
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
      // HISTORY is one section: the commits this lane/session added, then the files they touched.
      // The project's own commits around it are folded — context, not this session's story.
      const csec = el("div", "bsec");
      csec.appendChild(boardHead("History", "repo"));
      const base = brief.laneBase ?? "main";
      if (brief.commits.length) csec.appendChild(el("div", "bsubhead", brief.laneScoped ? `Commits on this lane`
        : brief.sessionStart ? "Commits this session" : "Recent commits"));
      else csec.appendChild(el("div", "bempty",
        brief.laneScoped ? `No commits on this lane yet.` : "No commits this session yet."));
      for (const cm of brief.commits) csec.appendChild(commitRow(cm, "session"));
      // …and when the SERVER's cap cut the list, say so rather than let 50 rows read as "all of
      // them" — the lane's own ahead-count is the honest total to compare against
      // a list that stops at its cap must say so — for a lane the true total is `ahead`, and a
      // time-scoped session has no total, so there the cap itself is the honest sentence
      if (brief.laneScoped && ahead > brief.commits.length)
        csec.appendChild(el("div", "bempty",
          `… ${ahead - brief.commits.length} older commit${ahead - brief.commits.length === 1 ? "" : "s"} — the brief carries the newest ${brief.commitsCap}`));
      else if (!brief.laneScoped && brief.commits.length >= brief.commitsCap)
        csec.appendChild(el("div", "bempty", `the newest ${brief.commitsCap} — this session may have made more`));

      // 4 — FILES: the committed footprint — what this lane/session changes vs its base.
      if (brief.files.length) {
        const fsec = csec;
        const fh = el("div", "bsubhead", brief.laneScoped ? `Changed vs ${base}` : "Changed files");
        if (brief.shortstat) fh.appendChild(el("span", "bsubstat", brief.shortstat.replace(/ changed|\(|\)/g, "")));
        fsec.appendChild(fh);
        // the whole committed footprint, uncut — same rule as the uncommitted list above
        for (const f of brief.files) {
          const row = el("button", "bfile");
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
        // the list above draws every file the brief carries; the only thing left to say is
        // whether the SERVER capped it, and that is a comparison against its own true total
        if (brief.filesTotal > brief.files.length)
          fsec.appendChild(el("div", "bempty",
            `… ${brief.filesTotal - brief.files.length} more — the brief carries the first 200`));
      }
      if (brief.repoCommits.length)
        csec.appendChild(boardFold("repoCommits", brief.laneScoped ? `Already in ${base}` : "Earlier in this repo",
          String(brief.repoCommits.length), (box) => { for (const cm of brief.repoCommits) box.appendChild(commitRow(cm, "repo")); }));
      nodes.push(csec);

      // 5 — EXPLORER: the repo's whole file tree, not just what changed. The card above answers
      // "what did this session touch"; this one answers "what is in here", which is the question
      // you have when you are reading rather than reviewing. Same destination either way — one
      // click opens the file view both cards already use.
      // Drawn only where there is a branch: the tree is `git ls-files`, so a session opened on a
      // plain directory would get a card whose only content is "not a git repo" on every repaint.
      // A detached HEAD loses the card too — the honest cost of reading git-ness off the one field
      // the brief already carries, rather than adding a probe to the 3s render for an edge case.
      // OPEN, not folded (owner, 2026-09-20: „[Zitat entfernt]“). The
      // tree keeps its own scroll box (public/index.html .fxtree), so a repo with 4000 files does
      // not push Lanes and the rest of the column off the screen.
      if (brief.branch) {
        const known = fxTree.get(s.cwd);
        fxGit.set(s.cwd, { lines: brief.uncommittedFiles, total: brief.uncommitted, branch: brief.branch });
        const fx = fileTreeSection(slot, s.cwd);
        const fhd = boardHead("Files", "repo");
        if (known && !("error" in known)) fhd.appendChild(el("span", "bsubstat", String(known.total)));
        fx.insertBefore(fhd, fx.firstChild);
        nodes.push(fx);
      }

      // 6 — LANES: the repo's lane map — every open worktree, who holds it, its state, and
      // the orphans (killed slot, worktree still on disk) with reattach/remove/discard +
      // ＋ new lane.
      // LANES — a section of its own, no longer folded away with the tools: the owner reads the
      // repo's open lanes as often as its commits, and asked for both in full view (2026-09-19,
      // "[Zitat entfernt]").
      if (wtErr) {
        const lfail = el("div", "bsec bfail");
        lfail.appendChild(boardHead("Lanes", "repo"));
        lfail.appendChild(el("div", "bstate", `The lane map could not be read — ${wtErr}.`));
        nodes.push(lfail);
      }
      if (wts) {
        const lsec = el("div", "bsec");
        const lhd = boardHead(`Lanes in ${baseName(wts.repo)}`, "repo");
        lhd.appendChild(el("span", "bsubstat", String(wts.worktrees.length)));
        lsec.appendChild(lhd);
        const sec = lsec;
        if (!wts.worktrees.length) sec.appendChild(el("div", "bempty", "No open lanes."));
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
            const open = el("button", "bwtact", w.review ? "resume" : "open") as HTMLButtonElement;
            open.title = w.review
              ? `reopen review candidate ${w.review.id} in a free slot — its tasks bind back to it, and verify evidence from before the park counts as stale`
              : "no session holds this worktree — reopen it in a free slot (reviewable/landable again)";
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
            nrow.appendChild(el("span", "sweepvbadge", w.review ? "⏸ review" : "⇲ shelved"));
            nrow.appendChild(el("span", "sweepvreason", w.note || "(no note)"));
            sec.appendChild(nrow);
          }
          // the review candidate's IDENTITY — what was parked, against what, carrying which verdict.
          // A review record, not gate-green; the deadline asks for a decision and removes nothing.
          if (w.review) {
            const c = w.review;
            const crow = el("div", "sweepv shelved");
            crow.appendChild(el("span", "sweepvbadge", `candidate ${c.id}`));
            crow.appendChild(el("span", "sweepvreason",
              `head ${c.head.slice(0, 10)} · base ${c.base ?? "unknown"}${c.baseSha ? ` @ ${c.baseSha.slice(0, 10)}` : ""}`
              + ` · report ${c.reportId.slice(0, 8)} · tasks ${c.taskIds.join(", ")}`
              + (c.expired ? ` · Frist abgelaufen ${new Date(c.expiresAt).toLocaleString()} — Entscheidung fällig`
                : ` · Frist ${new Date(c.expiresAt).toLocaleString()}`)));
            const live = w.preview && (w.preview.state === "running" || w.preview.state === "starting");
            if (!live) {
              const pvb = el("button", "bwtact", "preview") as HTMLButtonElement;
              pvb.title = `start a 30-minute isolated test instance of candidate ${c.id} at its stored head ${c.head.slice(0, 10)} — own socket, port and token, no live data; a view, not a verify result`;
              pvb.onclick = async () => {
                if (laneReqBusy) return;
                laneReqBusy = true;
                pvb.disabled = true;
                pvb.textContent = "starting…";
                try {
                  const r = await post(`/api/review-candidates/${c.id}/preview`, {});
                  if (!r.ok) alert(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "preview failed");
                } finally {
                  laneReqBusy = false;
                  void renderBoard();
                }
              };
              crow.appendChild(pvb);
            }
            // THE REVIEW ON PRESS: one advisory diff review of the stored head, only ever on this click
            if (!w.reviews?.some((r) => r.state === "running")) {
              const rvb = el("button", "bwtact", "review") as HTMLButtonElement;
              rvb.title = `one advisory agent review of candidate ${c.id}'s stored head ${c.head.slice(0, 10)} against its base — filed as a dated comment bound to the patch; not a gate, not a land decision`;
              rvb.onclick = async () => {
                if (laneReqBusy) return;
                laneReqBusy = true;
                rvb.disabled = true;
                rvb.textContent = "reviewing…";
                try {
                  const r = await post(`/api/review-candidates/${c.id}/review`, {});
                  if (!r.ok) alert(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "review failed");
                } finally {
                  laneReqBusy = false;
                  void renderBoard();
                }
              };
              crow.appendChild(rvb);
            }
            sec.appendChild(crow);
          }
          // the review COMMENTS on this worktree, oldest first: date, patch, and whether the tree still
          // carries that patch. They stay across a resume; a changed patch marks them stale, never removes them.
          for (const rv of w.reviews ?? []) {
            const rrow = el("div", "sweepv shelved");
            rrow.appendChild(el("span", "sweepvbadge", `review ${rv.state}`));
            rrow.appendChild(el("span", "sweepvreason",
              `${new Date(rv.at ?? rv.startedAt).toLocaleString()} · candidate ${rv.candidate} · patch ${rv.patchId.slice(0, 10)}`
              + ` · head ${rv.head.slice(0, 10)} vs ${rv.base}`
              + (rv.stale === true ? ` · VERALTET: der Worktree trägt jetzt Patch ${rv.patchNow?.slice(0, 10) ?? "?"}`
                : rv.stale === null ? " · aktueller Patch unlesbar — Aktualität unbekannt" : "")
              + (rv.state === "failed" && rv.why ? ` — ${rv.why}` : "")
              + " · beratend, kein Gate"));
            sec.appendChild(rrow);
            if (rv.state === "filed") {
              // the outcome lens's own frame: green while the tree carries this patch, amber once it moved on
              const body = el("div", `ocrev rel-${rv.stale === false ? "covered" : rv.stale ? "superseded" : "unmeasured"}`);
              for (const n of reviewBody({ ...rv, raw: rv.raw ?? undefined, at: rv.at ?? undefined, model: rv.model ?? undefined }))
                body.appendChild(n);
              sec.appendChild(body);
            }
          }
          // THE PREVIEW of that candidate: which candidate, which commit, where, until when — and
          // whether the lane has moved off that commit since. It stays after a resume (the lane then
          // carries on) and shows its end; it is a view the owner opens, never a verify result.
          if (w.preview) {
            const p = w.preview;
            const prow = el("div", "sweepv shelved");
            prow.appendChild(el("span", "sweepvbadge", `preview ${p.state}`));
            const when = (t: number) => new Date(t).toLocaleTimeString();
            const where = el("span", "sweepvreason",
              `candidate ${p.candidate} · commit ${p.head.slice(0, 10)}`
              + (p.state === "running" || p.state === "starting" ? ` · läuft bis ${when(p.expiresAt)}`
                : ` · beendet ${p.endedAt ? when(p.endedAt) : "?"}${p.why ? ` — ${p.why}` : ""}`)
              + (p.stale === true ? ` · VERALTET: Lane-Head ${p.laneHead?.slice(0, 10) ?? "?"} ≠ Vorschau-Commit`
                : p.stale === null ? " · Lane-Head unlesbar — Aktualität unbekannt" : "")
              + " · kein Verify-Beleg");
            prow.appendChild(where);
            if (p.url) {
              const a = el("a", "bwtact", p.url.replace(/\?token=.*$/, "")) as HTMLAnchorElement;
              a.href = p.url;
              a.target = "_blank";
              a.rel = "noopener";
              a.title = "open the preview instance (its own token rides in the link; it is not the board's)";
              prow.appendChild(a);
            }
            if (p.state === "running") {
              const stop = el("button", "bwtact del", "stop") as HTMLButtonElement;
              stop.title = "stop this preview now — its instance and scratch copy are removed";
              stop.onclick = async () => {
                const r = await post(`/api/review-candidates/${p.candidate}/preview/stop`, {});
                if (!r.ok) alert(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "stop failed");
                void renderBoard();
              };
              prow.appendChild(stop);
            }
            sec.appendChild(prow);
          }
          // THE OWNER'S NOTEPAD under the row of a worktree no slot holds — the parked candidate's
          // (or shelved orphan's) detail area, the same one text per path the live board shows.
          if (w.slot == null) sec.appendChild(notepadBlock(wts.repo, w));
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
        const nb = el("button", "bbtn quiet", "New lane") as HTMLButtonElement;
        nb.title = `Neue Lane von ${wts.main} — Name, Profil und Kontext im Gründungsfenster`;
        nb.onclick = () => { openLaneFounding(wts.repo); };
        sec.appendChild(nb);
        nodes.push(lsec);
      }
    }
    // The advisory agents (✨ summarize · 🔍 review) LEFT this column on 2026-09-20: the owner
    // called the setup behind those two buttons outdated. The server routes stay — the ③
    // auto-review writes the outcome ledger through them — only the board no longer offers them.

    // 9 — OUTLINE: prompt-jump navigation, kept at the bottom (lowest priority)
    tools.push(boardFold("prompts", "Your prompts", outlineErr ? "—" : String(prompts.length), (psec) => {
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
    // TOOLS: everything you reach for rather than read — folded, each fold remembered
    if (tools.length) {
      const tsec = el("div", "bsec btools");
      tsec.append(...tools);
      nodes.push(tsec);
    }
    // the focus moved to another pane while we were fetching — this render describes
    // the wrong slot; drop it (the re-run below paints the right one)
    if (panes[focused]?.slot !== slot) { boardAgain = true; return; }
    // rebuild in place but keep the reading position — AND the keyboard focus. Every node here
    // is new on every tick, so a focused control was dropped to <body> three times a minute; a
    // stable key (the element's own text plus its class) finds its successor after the swap.
    const y = boardBody.scrollTop;
    const focusKey = ((): string | null => {
      const a = document.activeElement;
      if (!(a instanceof HTMLElement) || !boardBody.contains(a)) return null;
      return `${a.tagName}\u0000${a.className}\u0000${(a.textContent ?? "").slice(0, 40)}`;
    })();
    boardBody.replaceChildren(...nodes);
    boardBody.scrollTop = y;
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
// above "is what you are looking at even the code that is running". A phone, whose board never
// renders, keeps it as a full-width bar above #mhead that pushes the page down instead of
// covering it. Ack (PLA_ACK_KEY) and the adjudicate paths (undo-land, suite.log) stay.
export let postLandAudit: PostLandAuditInfo | null = null;
export let plaCard: HTMLElement | null = null;

// The OWNER WORDS, built from the structured payload (proportional / remoteReason /
// remoteTimeoutMs) rather than from the classifier's sentences: src/plaudit.ts decides WHETHER an
// alarm exists and its tone (green is silent, red ≠ unknown — e2e/outcomes.ts runs it directly),
// this surface decides how it reads. The red split is the classifier's own: since 2026-09-04 a
// docs-only tip is audited by the short proportional chain, and calling that "the full suite"
// would send the reader to the wrong log and the wrong repair.
export function plaOwnerHeadline(a: PostLandAuditInfo, tone: "red" | "unknown"): string {
  if (tone === "red") {
    return a.proportional
      ? "The check after landing failed — the docs-only chain (install + pins) is failing on main"
      : "The check after landing failed — the full suite is failing on main";
  }
  if (a.remoteReason === "timeout") {
    const s = a.remoteTimeoutMs ? ` after ${Math.round(a.remoteTimeoutMs / 1000)}s` : "";
    return `The check after landing timed out${s} — it was killed on the helper, so no verdict exists for this land`;
  }
  if (a.remoteReason === "could-not-start")
    return "The check after landing could not start — the suite never ran on the helper, so no verdict exists for this land";
  return "The check after landing did not measure — no verdict exists for this land";
}
// the consequence under the headline: what this means for the reader, and the ways back out —
// undo-land stays named as the lane's own button, so the sentence needs no ↩ glyph (G0.6).
export function plaOwnerNote(tone: "red" | "unknown"): string {
  return tone === "red"
    ? "Nothing was blocked and nothing was rolled back. “Undo last land” (in a lane’s Lanes section) reverses the newest lands, one press per land, at most 3 deep — which of them broke it is still yours to find."
    : "A check that did not run is not a pass. Nothing about this land has been measured.";
}

// ONE BUILDER FOR BOTH SURFACES. Green is silent and an ack is keyed to THIS audit (PLA_ACK_KEY,
// src/plaudit.ts — the module under test); the receipt card is what an ack leaves behind, and its
// "show again" is the return path the dismissal never had (grammatik G5.1, card K7).
export function plaAlarmCard(): HTMLElement | null {
  const al = postLandAlarm(postLandAudit, prefNumber(PLA_ACK_KEY));
  if (!al) { plaCard = null; return null; }
  const a = postLandAudit!;
  const sec = el("details", `plasec ${al.tone}`);
  (sec as HTMLDetailsElement).open = plaCard instanceof HTMLDetailsElement && plaCard.open;
  const kind = al.tone === "red" ? "Land-Nachprüfung fehlgeschlagen" : "Land-Nachprüfung ungemessen";
  sec.appendChild(el("summary", "plasummary", `${kind} · ${a.main ?? "main"}@${a.mainSha?.slice(0, 8) || "?"}`));
  const detail = el("div", "pladetail");
  detail.appendChild(scopeTag("machine"));
  detail.appendChild(el("div", "plahd", plaOwnerHeadline(a, al.tone)));
  detail.appendChild(el("div", "plawhere", al.where));
  detail.appendChild(el("div", "hint planote", `${fmtTs(a.at)} · ${plaOwnerNote(al.tone)}`));
  // THE WHOLE LOG, when a remote helper handed one over. `out` on the row is a 4 KB tail, and for a
  // RED audit the next question is always "which checks, and what was around them" — an answer that
  // used to live only in a run directory the helper deletes in its own `finally`. Drawn only when
  // the rail actually joined something in: no link is "no log arrived", never an empty page.
  const art = a.artifact;
  if (art) {
    const line = el("div", "hint planote");
    const lg = el("a", "plalog", `suite.log · ${Math.max(1, Math.round(art.bytes / 1024))} KB`) as HTMLAnchorElement;
    lg.href = art.url;
    lg.target = "_blank";
    lg.rel = "noopener";
    lg.title = `The full suite log the helper uploaded after this verdict, ${art.bytes} bytes,`
      + ` sha256 ${art.sha256.slice(0, 12)}…. It arrived AFTER the row was written and is joined in`
      + ` from a side rail — nothing about it changed the result above.`;
    line.appendChild(lg);
    detail.appendChild(line);
  }
  const ack = el("button", "plaack", "Seen") as HTMLButtonElement;
  ack.title = "blendet diese Meldung aus — nur für diesen Prüflauf; die nächste nicht-grüne Prüfung meldet sich wieder (intern: fleet.plaudit.ack).";
  ack.onclick = () => {
    prefSet(PLA_ACK_KEY, String(postLandAudit?.at ?? 0));
    renderPostLandAudit();
  };
  detail.appendChild(ack);
  sec.appendChild(detail);
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
  sec.appendChild(scopeTag("machine"));
  sec.appendChild(el("div", "hint planote",
    `the ${a.result === "red" ? "failed" : "unfinished"} check after the last land (${fmtTs(a.at)}) is marked seen`));
  const back = el("button", "plaack", "show again") as HTMLButtonElement;
  back.title = "zeigt die Meldung wieder, die du als gesehen markiert hattest.";
  back.onclick = () => { prefSet(PLA_ACK_KEY, null); renderPostLandAudit(); };
  sec.appendChild(back);
  plaCard = sec;
  return sec;
}
export const plaBoardCard = (): HTMLElement | null => plaAlarmCard() ?? plaReceiptCard();

export function renderPostLandAudit() {
  const bar = $("plaudit");
  if (!isMobile()) void renderMobileAlarmHint();
  if (isMobile()) {
    bar.replaceChildren();
    bar.style.display = "none";
    void renderMobileAlarmHint();
    return;
  }
  bar.replaceChildren();
  bar.style.display = "none";
  // DESKTOP: the alarm is a board section. Swap the card in place when the board has one — the
  // alarm must not wait for the board's own repaint (it rides this 2s poll on purpose), and the
  // board's repaint must not yank the reading position just for it.
  const had = plaCard?.isConnected ? plaCard : null;
  const card = plaBoardCard();
  if (had) { if (card) had.replaceWith(card); else had.remove(); }
  else if (card && boardOpen) void renderBoard();
}

export let mobileAlarmGeneration = 0;
export async function renderMobileAlarmHint() {
  const hint = $("malarm") as HTMLButtonElement;
  const generation = ++mobileAlarmGeneration;
  if (!isMobile()) { hint.hidden = true; return; }
  const audit = postLandAlarm(postLandAudit, prefNumber(PLA_ACK_KEY));
  const slot = panes[focused]?.slot ?? 0;
  let failedLand = false;
  if (slot && fleet[slot - 1]?.worktree) {
    try {
      const res = await api(`/api/slots/${slot}/merge`);
      if (res.ok) failedLand = failedLandVerdict(((await res.json()) as MergeState).last);
    } catch { /* a missing verdict does not invent an alarm */ }
  }
  if (generation !== mobileAlarmGeneration) return;
  hint.hidden = !audit && !failedLand;
  hint.classList.toggle("unknown", !!audit && audit.tone === "unknown" && !failedLand);
  hint.title = failedLand ? "Land fehlgeschlagen — Details in Info öffnen" :
    audit?.tone === "unknown" ? "Land-Nachprüfung ungemessen — Details in Info öffnen" :
    "Land-Nachprüfung fehlgeschlagen — Details in Info öffnen";
  hint.onclick = () => setBoard(true);
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
