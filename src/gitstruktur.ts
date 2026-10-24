// THE GIT STRUCTURE IN INFO (K16, auftraege/k16-git-struktur.md; owner sketch Z79, 17.10. 11:5x, painted green 12:1x).
// Rectangles are git heads (main, the board's branches, lanes), circles are sessions, diamonds the checks a branch or lane
// passes to arrive above; the line after a diamond stays dashed until it landed. A circle stands where the session WORKS —
// its checkout and branch (owner 12:0x: „[Zitat entfernt]“): behind a branch it
// works on directly, in front of the lane it works in. Role and label only ride the circle's card, they never place it.
// Runde 2 (auftraege/k16-git-struktur-runde-2.md, owner Z81): a circle IS a slot — its number inside, filled green while
// the session works; a small card on hover names it; no line runs through a circle; a lane carries its session's name.
// Left of main a small commit point in the line's colour, never green: green belongs to active sessions and passed checks.
// Runde 3 (auftraege/k16-git-struktur-runde-3.md, owner Z83): the numbers only under the pointer (a tap on the phone), a
// lane named by its label, else its goal, else its board name, a landed charge with the check it landed with.
// Runde 5 (Bauleitung 345f671f, owner Z87): circles at about half their size, the slot on the card instead of in the
// circle; dashed up to the diamond too until the land; the legend a quiet line under the structure; all English.
// Runde 6 (owner Z118, 18.10.): green only where something runs or waits to land — a landed head has a quiet diamond and
// no part in next; a lane only where Fleet runs one; a circle reads the bar's own state. rechts-7 round 2 (owner 19.10.
// 15:1x: „[Zitat entfernt]“): a landed head's diamond
// is green inside, its edge quiet — apart from a passed check, and still no part in next.
// gitModel and gitLayout are pure (bun test reads them); gitStructure draws. Data: GET /api/worktrees (rows, lane parents,
// land checks), GET /api/branches (board branches, their merge-check), /api/sessions (cwd, git.branch, worktree).
import type { BranchCheckView, BranchesRepoView, WorkplaceRepo, WorkplaceRow } from "./protocol";
import { shortTitle } from "./suitemeter";

export type Diamond = "none" | "running" | "waiting" | "green" | "red" | "skipped" | "landed";
export interface GsSlot {
  id: number; cwd: string | null; label: string | null; openedAt?: number; repo?: string | null; taskTitle?: string;
  git?: { branch: string } | null; worktree?: { repo: string; branch: string } | null;
}
// what the card on a circle says: the name the bar gives the session, its role, agent and model
export interface GsCard { name: string; role: string | null; agent: string; model: string | null }
export interface GsSession { slot: number; active: boolean; where: string; card: GsCard }
// a running test instance of a head's checkout, with the port the server measured (Mangel 66: „der Port daneben“)
export interface GsTi { port: number | null }
// a lane is named by its session (owner Z81 „[Zitat entfernt]“); the id only when there is none.
// path: its worktree, where it has one; live: a live session's lane (src/board.ts#isLiveLane)
// older: a check of an older tip — for the tip now it is no check (owner 18.10. 23:4x, the dashed diamond was „[Zitat entfernt]“
// ); the hover names the commit it looked at ("" where the server does not say which)
// ahead: its commits not landed yet — a board branch's since its last batch, any other head's since its base; null once
// landed or where nothing is measured. Said in its menu and hover, never in its box (owner Z135/Z137, 19.10.)
export interface GsLane { branch: string; name: string; named: boolean; sessions: GsSession[]; check: Diamond; merged: boolean;
  ti: GsTi | null; live: boolean; path: string | null; older: string | null; ahead: number | null }
// one row under main: a branch (with its lanes under it) or a lane that lands on main itself
export interface GsItem extends GsLane { kind: "branch" | "lane"; lanes: GsLane[] }
// next: the branches whose merge-check is green — „becomes main when this charge lands“; none green, null (the drawing then
// shows next quiet: nothing ready to land yet). It has no
// head of its own: the land builds a new commit with the same tree, so the candidate's SHA would be a false claim.
// main's check after a land is no sign here (owner Z86: „[Zitat entfernt]“) — it is text in main's menu.
// main carries no test instance (owner Z137: one belongs to a branch or a lane) — Devices still lists one that runs
export interface GsModel { repo: string; integration: string; head: string | null; sessions: GsSession[]; items: GsItem[]; next: string[] | null }
// what the board knows beside the rows: which lane is a live one, and a lane check that runs on a helper before the row
// says so (src/board.ts#gateLook)
// hide: what the gear in the head leaves out (owner Z124/Z131) — landed heads nobody works at, heads without a session
export interface GsOpts { live?: (branch: string) => boolean; run?: (w: WorkplaceRow) => "running" | "waiting" | null;
  hide?: { landed: boolean; idle: boolean } }
const tiOf = (w: WorkplaceRow | undefined): GsTi | null => {
  if (w?.testinstanz?.state !== "up") return null;
  const port = w.testinstanz.instance.port;
  return { port: typeof port === "number" ? port : null };
};

export function gitModel(R: WorkplaceRepo, board: BranchesRepoView | undefined, slots: readonly GsSlot[],
  active: (slot: number) => boolean, describe: (s: GsSlot) => GsCard, opts: GsOpts = {}): GsModel {
  const integration = board?.integration ?? "main";
  const rows = R.worktrees ?? [];
  const head = R.branches?.find((b) => b.branch === integration)?.head ?? board?.branches.find((b) => b.branch === integration)?.head ?? null;
  const sessionOf = (s: GsSlot, where: string): GsSession => ({ slot: s.id, active: active(s.id), where, card: describe(s) });
  const items = new Map<string, GsItem>();
  const item = (branch: string, kind: GsItem["kind"]): GsItem => {
    const had = items.get(branch);
    if (had) return had;
    const b = board?.branches.find((x) => x.branch === branch);
    // merged: it landed before and has no commit since that charge (chargeCommits; the land writes a new commit with the
    // same tree, so „ahead of main“ never drops to 0) — a branch without a land has not arrived above
    // A LANDED CHARGE has a diamond of its own (owner Z83: the dashed „[Zitat entfernt]“ one after a land read as an accident;
    // 19.10.: grey read as strange — green inside, see GS_CSS) — which check it landed with stands in its batch. The
    // branch's own check goes stale at the land, so it speaks again only once the branch has commits since
    const last = b?.lands.at(-1);
    const merged = !!last && b?.chargeCommits === 0;
    // the server says which tip a stale check looked at in its why ("geprüft war <sha> gegen <base>", server.ts#chargeCheckView)
    const st = b?.check?.state ?? "none", stale = st === "stale";
    const made: GsItem = { kind, branch, name: b?.name || branch, named: !!b?.name, sessions: [],
      check: merged ? "landed" : st === "stale" ? "none" : st, merged, lanes: [], ti: null, live: false, path: null,
      older: !merged && stale ? (/\b[0-9a-f]{7,40}\b/.exec(b?.check?.why ?? "")?.[0].slice(0, 7) ?? "") : null,
      ahead: merged ? null : b?.chargeCommits ?? null };
    items.set(branch, made);
    return made;
  };
  for (const b of board?.branches ?? []) if (b.branch !== integration) item(b.branch, "branch");
  const boardNames = new Set((board?.branches ?? []).map((b) => b.branch));
  const mainSessions: GsSession[] = [];
  const placed = new Set<number>();
  const slotIn = (w: WorkplaceRow): GsSlot | undefined => {
    if (!w.session) return undefined;
    const s = slots.find((x) => x.id === w.session!.slot);
    return s?.cwd && (s.openedAt === undefined || s.openedAt === w.session.openedAt) ? s : undefined;
  };
  const lanesOn = new Map<string, GsLane[]>();
  // the bar's automatic lane name is „⎇ <repo> <4 hex>“: that is the id again, not a name — the repo is the head above
  const repoWord = `${R.repo.split("/").filter(Boolean).pop() ?? ""} `;
  const fromLabel = (label: string): string | null => {
    const l = label.replace(/^⎇\s*/, "").trim();
    const rest = l.startsWith(repoWord) ? l.slice(repoWord.length) : l;
    return rest && !/^[0-9a-f]{4,}$/.test(rest) ? rest : null;
  };
  // A LANE'S NAME (owner Z83 „[Zitat entfernt]“): the session's label, else the lane's goal
  // as the server derives it from the founding card (taskTitle), else the board's name of its branch — its short end only
  // when none of them is there. An own label reads off the card (the bar's name, without the model it may end in); the
  // dispatcher's „⎇ task …“ (server.ts#tickDispatch) is its slug of the task, so the goal names that lane, as the bar does
  const laneName = (s: GsSlot | undefined, card: GsCard | undefined, branch: string): string | null => {
    const own = s?.label && !s.label.startsWith("⎇") ? fromLabel(card?.name ?? s.label)
      : s?.label && !/^⎇\s*task\s/.test(s.label) ? fromLabel(s.label) : null;
    return own ?? (s?.taskTitle ? shortTitle(s.taskTitle) : null) ?? (board?.branches.find((b) => b.branch === branch)?.name || null);
  };
  for (const w of rows) {
    if (w.primary || !w.branch) continue;
    const s = slotIn(w);
    if (s) placed.add(s.id);
    // A LANE only where Fleet runs one (owner Z118: „[Zitat entfernt]“): a lane session (its
    // slot has a worktree), a task's row, or a branch Fleet named for a lane — any other worktree is a branch
    const lane = s?.worktree ? true : boardNames.has(w.branch) ? false : !!w.session?.taskId || w.branch.startsWith("fleet/");
    if (w.branch === integration) {
      if (s) mainSessions.push(sessionOf(s, `on ${integration}`));
    } else if (!lane) {
      const it = item(w.branch, "branch");
      if (s) it.sessions.push(sessionOf(s, `directly on ${w.branch}`));
    } else {
      const parent = w.target?.branch ?? w.base?.branch ?? integration;
      const ses = s ? sessionOf(s, `in lane ${w.branch}`) : null;
      const name = laneName(s, ses?.card, w.branch);
      const lane: GsLane = { branch: w.branch, name: name ?? (w.branch.split(/[/-]/).pop() || w.branch), named: name !== null,
        sessions: ses ? [ses] : [], check: w.target?.landed === "yes" ? "landed" : opts.run?.(w) ?? w.checks.gate?.state ?? "none",
        merged: w.target?.landed === "yes",
        ti: tiOf(w), live: opts.live?.(w.branch) ?? false, path: w.path, older: null,
        ahead: w.target?.landed === "yes" ? null : w.distance?.ahead ?? null };
      lanesOn.set(parent, [...(lanesOn.get(parent) ?? []), lane]);
    }
  }
  // the main checkout: a session there works on whatever branch that checkout has
  for (const s of slots) {
    if (!s.cwd || s.worktree || placed.has(s.id) || (s.repo ?? s.cwd) !== R.repo) continue;
    const on = s.git?.branch ?? integration;
    if (on === integration) mainSessions.push(sessionOf(s, `on ${integration} in the main checkout`));
    else item(on, "branch").sessions.push(sessionOf(s, `directly on ${on} in the main checkout`));
  }
  for (const [parent, lanes] of lanesOn) {
    if (parent === integration) for (const l of lanes) items.set(`lane:${l.branch}`, { kind: "lane", ...l, lanes: [] });
    else item(parent, "branch").lanes.push(...lanes);
  }
  const all = [...items.values()];
  // a branch's checkout: its own worktree, else the main checkout while that has the branch
  const primary = rows.find((w) => w.primary);
  for (const it of all) if (it.kind === "branch") {
    const w = rows.find((x) => !x.primary && x.branch === it.branch) ?? (primary?.branch === it.branch ? primary : undefined);
    it.ti = tiOf(w);
    it.path = w?.path ?? null;
    if (!boardNames.has(it.branch)) it.ahead = w?.distance?.ahead ?? R.branches?.find((b) => b.branch === it.branch)?.distance?.ahead ?? null;
  }
  const green = all.filter((i) => i.kind === "branch" && i.check === "green").map((i) => i.branch);
  // THE GEAR'S SWITCHES (owner Z124 „[Zitat entfernt]“, Ja 18.10. 22:4x): a hidden head is one
  // no session works at — landed with nothing since, or with no check running or waiting; a branch stays while a lane
  // under it stays. next still counts every green branch: it says what main becomes
  const { landed = false, idle = false } = opts.hide ?? {};
  const gone = (l: GsLane) => !l.sessions.length && ((landed && l.merged) || (idle && l.check !== "running" && l.check !== "waiting"));
  const shown = all.flatMap((i) => {
    const lanes = i.lanes.filter((l) => !gone(l));
    return gone(i) && !lanes.length ? [] : [{ ...i, lanes }];
  });
  return { repo: R.repo, integration, head, sessions: mainSessions, items: shown, next: green.length ? green : null };
}

// THE SESSION'S REPO (owner Z131: „[Zitat entfernt]“
// ): a lane names its repo; any other session reports the top of its checkout (server.ts#repoInfo), and for a
// session in a linked worktree — a branch session — that top is the worktree, so the repo is the one holding the
// innermost checkout around it
export function sessionRepo(s: GsSlot, repos: readonly WorkplaceRepo[]): WorkplaceRepo | undefined {
  if (!s.cwd) return undefined;
  if (s.worktree) return repos.find((R) => R.repo === s.worktree?.repo);
  const at = s.repo ?? s.cwd;
  let best: { R: WorkplaceRepo; len: number } | undefined;
  for (const R of repos) for (const p of [R.repo, ...(R.worktrees ?? []).map((w) => w.path)])
    if ((at === p || at.startsWith(`${p}/`)) && p.length > (best?.len ?? -1)) best = { R, len: p.length };
  return best?.R;
}

// THE DRAWING: one row per head, rows 30 px apart; main on top, its items below, each branch's lanes below it.
// Columns: the trunk under main, the sub-trunk under a branch, a lane's diamond and its collector, a branch's diamond and
// the collector every row arrives on before next. NOT SCALED (Bauleitung 17.10., e105c447: scaled to the column the text
// stood at 8–10 px against the Info tab's 12): the drawing is as wide as its column, its text in the Info tab's own size;
// the left columns stand fixed, the right ones hang from the column's right edge, and a rectangle takes what is left
// between — a name that does not fit ends in … (owner 15:1x: the full name is a click away, in the card and in step 1)
// ONE DIAMOND SIZE (owner Z86: „[Zitat entfernt]“); circles at about half (owner Z87: „[Zitat entfernt]“)
const ROW = 30, RH = 20, TOP = 14, CR = 5, CSTEP = 13, TI_SQ = 8, DR = 5;
const X = { dot: 5, main: 12, mainW: 56, trunk: 24, l1: 38, sub: 50, l2: 80 };
const NEXT_W = 40, RECT_MIN = 48, BRANCH_MAX = 120, LANE_MAX = 170;
// the average width of a character at the Info tab's 12 px, for the drawing's own estimate before the browser measures
const CH = 6.9, CH_MONO = 7.3;
export const GS_DEFAULT_WIDTH = 320;
// next always holds its column at the right (rechts-7 B), 14 px narrower than before so a lane's test instance and its port
// keep their place beside the lane's rectangle (Mangel 66)
const cols = (W: number) => {
  const Xc = W - 2 - NEXT_W - 18;
  return { Xc, Xb: Xc - 16, Xl: Xc - 28, Xld: Xc - 40 };
};
// a rectangle and the test instance after it share what is left of a row: the instance only where the rectangle keeps its
// least width beside it — its port stands in step 1 in any case
const share = (avail: number, max: number, ti: GsTi | null): { w: number; ti: GsTi | null } => {
  const need = ti ? 6 + tiWidth(ti) + 4 : 0;
  return ti && avail - need >= RECT_MIN ? { w: Math.min(max, avail - need), ti } : { w: Math.max(RECT_MIN, Math.min(max, avail)), ti: null };
};
const SVGNS = "http://www.w3.org/2000/svg";

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, title?: string): SVGElementTagNameMap[K] {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  if (title) { const t = document.createElementNS(SVGNS, "title"); t.textContent = title; n.appendChild(t); }
  return n;
}
const fit = (text: string, width: number): string => {
  const max = Math.max(3, Math.floor((width - 12) / CH));
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
};
const CHECK_WORD: Record<Diamond, string> = { none: "not checked yet", running: "check running", waiting: "check waiting",
  green: "check passed", red: "check failed", skipped: "no check", landed: "landed" };
const NEXT_QUIET = "nothing ready to land yet — a branch shows here once its merge check is green on the current main";
// a number never ends a line apart from its word (no-break spaces)
const commits = (n: number): string => `${n}\u00a0${n === 1 ? "commit" : "commits"}`;
// what a head's hover adds: its commits not landed yet — its box carries no number (owner Z135)
const notLanded = (n: number | null): string => (n ? ` · ${commits(n)} not landed yet` : "");

// THE GEOMETRY, pure: every shape with its place, so a check reads where a circle stands against its head.
// gap: a selected row opens its menu under it (owner Z83 „[Zitat entfernt]“) — every row below moves down by h
export type GsShape =
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; open: boolean }
  | { t: "rect"; x: number; y: number; w: number; text: string; kind: "main" | "branch" | "lane"; key: string; title: string; live: boolean; quiet?: boolean }
  | { t: "circle"; x: number; y: number; r: number; ses: GsSession; at: string }
  | { t: "diamond"; x: number; y: number; r: number; d: Diamond; merged: boolean; of: string; older?: string | null }
  | { t: "ti"; x: number; y: number; w: number; port: number | null; of: string }
  | { t: "point"; x: number; y: number; title: string };
export const tiWidth = (ti: GsTi): number => (ti.port === null ? TI_SQ : TI_SQ + 4 + Math.ceil(CH_MONO * `:${ti.port}`.length));
export function gitLayout(m: GsModel, opts: { width?: number; gap?: { after: string; h: number } } = {}): { width: number; height: number; shapes: GsShape[] } {
  const { gap } = opts;
  const W = Math.round(opts.width ?? GS_DEFAULT_WIDTH);
  const { Xc, Xb, Xl, Xld } = cols(W);
  const shapes: GsShape[] = [];
  const line = (x1: number, y1: number, x2: number, y2: number, open = false) => { if (x1 !== x2 || y1 !== y2) shapes.push({ t: "line", x1, y1, x2, y2, open }); };
  // a horizontal run from x1 to x2 past marks on it (circles, a test instance): the line stops at each
  // mark's edge and goes on behind it — no line runs through a mark
  const run = (x1: number, x2: number, yy: number, marks: [number, number][], open = false) => {
    let from = x1;
    for (const [a, b] of [...marks].sort((p, q) => p[0] - q[0])) { line(from, yy, a, yy, open); from = b; }
    line(from, yy, x2, yy, open);
  };
  const circle = (x: number, yy: number, ses: GsSession, at: string) => shapes.push({ t: "circle", x, y: yy, r: CR, ses, at });
  // the test instance after what a row carries: its square and port, a gap of 6 before it
  const ti = (t: GsTi | null, from: number, yy: number, of: string): [number, number][] => {
    if (!t) return [];
    const x = from + 6, w = tiWidth(t);
    shapes.push({ t: "ti", x, y: yy, w, port: t.port, of });
    return [[x - 2, x + w + 2]];
  };
  const mainKey = `main:${m.integration}`;
  let y = TOP;
  const opened = (key: string) => { if (gap?.after === key) y += gap.h; };
  const mainY = y;
  opened(mainKey);
  const lay = m.items.map((it) => {
    y += ROW; const at = y;
    opened(`${it.kind}:${it.branch}`);
    const lanes = it.lanes.map((l) => { y += ROW; const ly = y; opened(`lane:${l.branch}`); return { l, y: ly }; });
    return { it, y: at, lanes };
  });
  if (lay.length) line(X.trunk, mainY + RH / 2, X.trunk, lay.at(-1)!.y);
  const mainCircles = m.sessions.map((_, k) => X.main + X.mainW + 6 + CR + k * CSTEP);
  run(X.main + X.mainW, Xc, mainY, mainCircles.map((cx) => [cx - CR, cx + CR]));
  // NEXT ALWAYS STANDS (owner 18.10. 23:4x: „[Zitat entfernt]“; Ja 19.10. 03:38 on the proposal): quiet and
  // grey with a hollow diamond while no branch is green on the current main, ready once one is
  const ready = !!m.next;
  const why = m.next ? `becomes ${m.integration} when ${m.next.length === 1 ? `the batch of ${m.next[0]} lands` : `the batches of ${m.next.join(", ")} land`}`
    : NEXT_QUIET;
  line(Xc, mainY, Xc + 9 - DR, mainY, !ready);
  shapes.push({ t: "diamond", x: Xc + 9, y: mainY, r: DR, d: ready ? "green" : "none", merged: false, of: "next" });
  line(Xc + 9 + DR, mainY, Xc + 18, mainY, !ready);
  shapes.push({ t: "rect", x: Xc + 18, y: mainY, w: NEXT_W, text: "next", kind: "main", key: "next", title: `next — ${why}`, live: false, quiet: !ready });
  // A ROW'S WAY UP is dashed until it landed (owner Z81 c; Z87: the stretch up to the diamond too): a stretch of a collector
  // that several rows share is drawn once, dashed while any row arriving over it has not landed — two dashes on top of each
  // other read as a line. Only where a head leaves its parent is the line solid
  lay.forEach(({ it, y: yy, lanes }, i) => {
    const key = `${it.kind}:${it.branch}`;
    // a lane on main: its circle in front, the rectangle shortened by the circle so both diamonds stand in one column
    const x0 = it.kind === "lane" ? X.l1 + 2 * CR + 4 : X.l1;
    const behindRoom = it.kind === "branch" && it.sessions.length ? 6 + CR + (it.sessions.length - 1) * CSTEP + CR : 0;
    const { w, ti: rowTi } = share(Xb - 6 - x0 - behindRoom, it.kind === "lane" ? LANE_MAX : BRANCH_MAX, it.ti);
    if (it.kind === "lane") {
      const cx = X.l1 + CR;
      run(X.trunk, x0, yy, it.sessions.length ? [[cx - CR, cx + CR]] : []);
      it.sessions.forEach((ses) => circle(cx, yy, ses, key));
    } else line(X.trunk, yy, X.l1, yy);
    shapes.push({ t: "rect", x: x0, y: yy, w, text: it.name, kind: it.kind, key, title: (it.named ? `${it.name} — ${it.branch}` : it.branch) + notLanded(it.ahead), live: it.live });
    const behind = it.kind === "branch" ? it.sessions.map((_, k) => x0 + w + 6 + CR + k * CSTEP) : [];
    const marks: [number, number][] = behind.map((cx) => [cx - CR, cx + CR]);
    marks.push(...ti(rowTi, behind.length ? behind.at(-1)! + CR : x0 + w, yy, key));
    run(x0 + w, Xb - DR, yy, marks, !it.merged);
    if (it.kind === "branch") it.sessions.forEach((ses, k) => circle(behind[k]!, yy, ses, key));
    shapes.push({ t: "diamond", x: Xb, y: yy, r: DR, d: it.check, merged: it.merged, of: key, older: it.older });
    line(Xb + DR, yy, Xc, yy, !it.merged);
    line(Xc, yy, Xc, i ? lay[i - 1]!.y : mainY, lay.slice(i).some((r) => !r.it.merged));
    if (lanes.length) line(X.sub, yy + RH / 2, X.sub, lanes.at(-1)!.y);
    lanes.forEach(({ l, y: ly }, j) => {
      const lk = `lane:${l.branch}`, cx = X.l2 - 4 - CR;
      run(X.sub, X.l2, ly, l.sessions.length ? [[cx - CR, cx + CR]] : []);
      l.sessions.forEach((ses) => circle(cx, ly, ses, lk));
      const lw = share(Xld - DR - 6 - X.l2, LANE_MAX, l.ti);
      shapes.push({ t: "rect", x: X.l2, y: ly, w: lw.w, text: l.name, kind: "lane", key: lk, title: (l.named ? `${l.name} — ${l.branch}` : l.branch) + notLanded(l.ahead), live: l.live });
      run(X.l2 + lw.w, Xld - DR, ly, ti(lw.ti, X.l2 + lw.w, ly, lk), !l.merged);
      shapes.push({ t: "diamond", x: Xld, y: ly, r: DR, d: l.check, merged: l.merged, of: lk });
      line(Xld + DR, ly, Xl, ly, !l.merged);
      line(Xl, ly, Xl, j ? lanes[j - 1]!.y : yy, lanes.slice(j).some((r) => !r.l.merged));
    });
  });
  // main last, over its lines: the commit point, the head, the sessions behind it
  const at = m.head ? `${m.integration} at ${m.head.slice(0, 8)}` : `${m.integration}: tip unknown`;
  shapes.push({ t: "point", x: X.dot, y: mainY, title: at });
  shapes.push({ t: "rect", x: X.main, y: mainY, w: X.mainW, text: m.integration, kind: "main", key: mainKey, title: at, live: false });
  m.sessions.forEach((ses, k) => circle(mainCircles[k]!, mainY, ses, mainKey));
  return { width: W, height: y + RH / 2 + 8, shapes };
}

// THE CARD on a circle (owner Z81 a): name, slot and role, agent · model, and whether it works right now. The slot stands
// here, not in the circle: at half the size a number no longer fits (Bauleitung 345f671f)
export function cardLines(ses: GsSession): string[] {
  return [ses.card.name || `Slot ${ses.slot}`, `Slot ${ses.slot}${ses.card.role ? ` · ${ses.card.role}` : ""}`,
    `${ses.card.agent}${ses.card.model ? ` · ${ses.card.model}` : ""}`, `${ses.active ? "working now" : "resting"} · ${ses.where}`];
}

// THE SUBMENUS (owner Z83 „[Zitat entfernt]“; the list: Bestandsaufnahme 3db17b9a, Ja 3e75a836).
// SIMPLE (owner Z86: „[Zitat entfernt]“): step 1 of a
// head begins with its test instance — state, port, start/open/stop — then at most three facts, then quiet words;
// the points left the menu (they stay on the server), and so did Diff, Passt and Landen (owner Z87: „[Zitat entfernt]“
//  — the routes stay). A word acts at once or opens step 2. Which head offers
// what is decided here, pure — the board builds it
export type GsWord = "testinstanz" | "live" | "landform" | "session" | "neustart" | "worktree" | "mergen" | "charge" | "pruefen" | "pruefungen";
export const GS_WORD: Record<GsWord, { label: string; acts: boolean }> = {
  testinstanz: { label: "Test instance", acts: false }, live: { label: "Live session", acts: false }, landform: { label: "On land", acts: false },
  session: { label: "Start session", acts: true }, neustart: { label: "Restart", acts: true }, worktree: { label: "Worktree", acts: false },
  mergen: { label: "Merge", acts: true }, charge: { label: "Batch", acts: false }, pruefen: { label: "Check", acts: true },
  pruefungen: { label: "Checks", acts: false },
};
// what the board knows of a head: which click it is, whether the board keeps its branch (K5 — its batch and land form),
// its session's slot, whether that hangs, its checkout, landed, mirrored (read-only), live
export interface GsHead { at: "main" | "branch" | "lane" | "branch-check" | "lane-check"; board: boolean; slot: number | null;
  hung: boolean; worktree: boolean; landed: boolean; mirror: boolean; live: boolean }
// what a board branch's merge check says of its tip, in step 1 and on its diamond (`why` is the check's own words)
// …and, in step 1 of a branch, where a session's proposal waits: its “Use it” stands on the diamond, not there
export function mergeCheckLine(chk: BranchCheckView | null, proposedBy: string | null = null): string {
  return !chk ? (proposedBy ? `no check command yet — ${proposedBy} proposes one, “Use it” on the diamond` : "no check command in this repo")
    : chk.state === "running" ? "merge check running …"
    : chk.state === "green" ? "merge check green" : chk.state === "red" ? `merge check red: ${chk.why ?? "no reason given"}`
    : chk.state === "stale" ? "merge check on an older state — check again" : "no merge check on this state yet";
}
// a checkout's distance in step 1, as a sentence (owner Z135: the count in the menu, not in the box): its commits not landed
// yet — `ahead` where the board counts them (a board branch since its last batch), else since where it branched — and how
// far behind its target it is as the target stands NOW (target.behind, the number the lane's Rebase button names) — the
// fork-point distance says 0 behind long after the target moved on
export function distanceLine(w: WorkplaceRow, ahead: number | null = w.distance?.ahead ?? null): string | null {
  return w.distance && ahead !== null ? `${commits(ahead)} not landed yet, ${w.target.behind ?? w.distance.behind}\u00a0behind ${w.target.branch}` : null;
}
export function headWords(h: GsHead): GsWord[] {
  // the test instance first wherever a branch or a lane has a checkout to run one from — never at main (owner Z137: „[Zitat entfernt]“); a repo without its template shows no line (src/board.ts#gsPanel)
  const ti: GsWord[] = h.worktree && !h.mirror ? ["testinstanz"] : [];
  // how its next batch lands (a board branch: BranchRecord.landForm; a lane: the browser's choice) — gone once landed
  const form: GsWord[] = !h.landed && !h.mirror ? ["landform"] : [];
  // a board branch without a session starts one here; a session that is there is a fact of step 1 (a click jumps)
  const session: GsWord[] = h.board && h.slot === null ? ["session"] : h.board && h.hung ? ["neustart"] : [];
  // a worktree no session holds: open it in a free slot (a board branch starts its session instead)
  const tree: GsWord[] = !h.board && h.slot === null && h.worktree && !h.mirror ? ["worktree"] : [];
  switch (h.at) {
    // the project's land form for every lane moved to the gear in the head (owner Ja 18.10. 22:4x)
    case "main": return ["live"];
    case "branch": return [...ti, ...(h.board ? form : []), ...session, ...tree];
    case "lane": return [...ti, ...form, ...(h.live && h.slot !== null && !h.landed ? ["mergen" as const] : []), ...session, ...tree];
    case "branch-check": return h.board ? ["charge", "pruefen"] : [];
    case "lane-check": return ["pruefungen"];
  }
}

// THE LEGEND (owner Z86: „[Zitat entfernt]“), behind a quiet line
// under the structure (Z87: the i was „[Zitat entfernt]“): the signs this drawing uses, one line each
// — a sign one line cannot explain does not belong in the drawing
export type GsSign = "rect" | "rect-live" | "circle" | "circle-on" | "diamond-none" | "diamond-running" | "diamond-green" | "diamond-red"
  | "diamond-skipped" | "diamond-landed" | "line-open" | "line" | "ti" | "point";
export const GS_LEGEND: Record<GsSign, string> = {
  rect: "Git head: main, a branch or a lane", "rect-live": "Lane of a live session",
  circle: "Slot with a session, resting", "circle-on": "Slot with a session, working right now",
  "diamond-none": "Check on the way up: none yet", "diamond-running": "Check running or waiting",
  "diamond-green": "Check passed", "diamond-red": "Check failed",
  "diamond-skipped": "Check skipped", "diamond-landed": "Landed", "line-open": "Dashed: not landed yet", line: "Solid: landed, or where a head branches off",
  ti: "Test instance running, its port beside it", point: "Commit point: where main stands",
};
export function signOf(p: GsShape): GsSign {
  if (p.t === "rect") return p.live ? "rect-live" : "rect";
  if (p.t === "circle") return p.ses.active ? "circle-on" : "circle";
  if (p.t === "diamond") return p.d === "waiting" ? "diamond-running" : `diamond-${p.d}`;
  if (p.t === "line") return p.open ? "line-open" : "line";
  return p.t;
}
// the signs a drawing uses, in the legend's order
export const signsOf = (shapes: readonly GsShape[]): GsSign[] => {
  const used = new Set(shapes.map(signOf));
  return (Object.keys(GS_LEGEND) as GsSign[]).filter((k) => used.has(k));
};
// a sign drawn small for its legend line, as the structure draws it
function sample(sign: GsSign): SVGSVGElement {
  const g = svg("svg", { class: "gss gslg", width: 28, height: 16, viewBox: "0 0 28 16", "aria-hidden": "true" });
  const dia = (d: Diamond, merged: boolean) => svg("path", { d: `M14 ${8 - DR} L${14 + DR} 8 L14 ${8 + DR} L${14 - DR} 8 Z`, class: `gsd ${d}${merged ? "" : " open"}` });
  const wrapped = (cls: string, child: SVGElement) => { const w = svg("g", { class: cls }); w.appendChild(child); g.appendChild(w); };
  if (sign === "rect" || sign === "rect-live") wrapped(`gsr lane${sign === "rect-live" ? " live" : ""}`, svg("rect", { x: 2, y: 3, width: 24, height: 10, rx: 3 }));
  else if (sign === "circle" || sign === "circle-on") wrapped(`gsk${sign === "circle-on" ? " on" : ""}`, svg("circle", { cx: 14, cy: 8, r: 6 }));
  else if (sign.startsWith("diamond-")) g.appendChild(dia(sign === "diamond-running" ? "running" : sign.slice(8) as Diamond, sign !== "diamond-none"));
  else if (sign === "line" || sign === "line-open") g.appendChild(svg("path", { d: "M2 8 L26 8", class: `gsl${sign === "line-open" ? " open" : ""}` }));
  else if (sign === "ti") wrapped("gst", svg("rect", { x: 10, y: 4, width: TI_SQ, height: TI_SQ, rx: 1.5 }));
  else g.appendChild(svg("circle", { cx: 14, cy: 8, r: 2.5, class: "gsp" }));
  return g;
}

// what the board hands the drawing: the fold, the legend, the head's right side (the project's state, „+“), the selection
// and its menu, the jump to a session, and lines that stay in sight under the structure
export interface GsUi {
  open: boolean; toggle: () => void; info: boolean; toggleInfo: () => void; side: HTMLElement[];
  // the gear's panel under the head, while it is open (src/board.ts#gsSettings)
  settings: HTMLElement | null;
  sel: string | null; select: (key: string | null) => void; jump: (slot: number) => void;
  // the menu of the selection; fresh: what just opened unfolds once, calmly — the first step, or the second under it
  panel: HTMLElement | null; fresh: "step1" | "step2" | null; below: HTMLElement[];
}
// a selection is a row's key, or „dia:“ and a row's key for its diamond; its menu opens under that row
export const rowOf = (sel: string): string => (sel.startsWith("dia:") ? sel.slice(4) : sel);
const UNFOLD_MS = 280;

export function gitStructure(m: GsModel, ui: GsUi): HTMLElement {
  const { open } = ui;
  const box = document.createElement("div");
  box.className = `gs${open ? " open" : ""}`;
  box.dataset.repo = m.repo;
  const head = document.createElement("div");
  head.className = "gsh";
  const fold = document.createElement("button");
  fold.type = "button";
  fold.className = "gsf";
  fold.setAttribute("aria-expanded", String(open));
  const name = m.repo.split("/").filter(Boolean).pop() ?? m.repo;
  // „› repo ‹“ while folded, the name bold (owner Z121: „[Zitat entfernt]“);
  // opening turns the front bracket down by 90° (Z122: „[Zitat entfernt]“)
  fold.append(Object.assign(document.createElement("span"), { className: "gsv", textContent: "›" }),
    Object.assign(document.createElement("span"), { className: "gsn", textContent: name }),
    Object.assign(document.createElement("span"), { className: "gsc", textContent: "‹" }));
  // A REAL FOLD SWITCH (owner Z83: the brackets were „[Zitat entfernt]“):
  // a button of at least 32 px with a visible focus — Enter and Space are a button's own — the front bracket turns 90°
  fold.title = `${m.repo} — ${open ? "collapse" : "expand"} the git structure`;
  fold.onclick = ui.toggle;
  const side = document.createElement("span");
  side.className = "gsside";
  side.append(...ui.side);
  head.append(fold, side);
  box.appendChild(head);
  if (ui.settings) box.appendChild(ui.settings);
  if (!open) return box;

  const wrap = document.createElement("div");
  wrap.className = "gsw";
  const s = svg("svg", { class: "gss", role: "group", "aria-label": `Git structure of ${name}` });
  const card = document.createElement("div");
  card.className = "gscard";
  card.hidden = true;
  let shownFor: number | null = null;
  const show = (g: SVGGElement, ses: GsSession) => {
    card.replaceChildren(...[...cardLines(ses), "Click, or tap again: go to the session"]
      .map((t, k) => Object.assign(document.createElement(k ? "div" : "b"), { textContent: t })));
    card.classList.toggle("on", ses.active);
    card.hidden = false;
    shownFor = ses.slot;
    const r = g.getBoundingClientRect(), w = wrap.getBoundingClientRect();
    const left = Math.min(r.left - w.left, w.width - 200);
    card.style.left = `${Math.max(0, left)}px`;
    card.style.top = `${r.bottom - w.top + 4}px`;
  };
  const hide = () => { card.hidden = true; shownFor = null; };
  // a head or a diamond is a button: a click or Enter/Space selects it, the same again closes its menu
  const pressable = (g: SVGElement, key: string, label: string) => {
    const on = ui.sel === key;
    g.setAttribute("tabindex", "0");
    g.setAttribute("role", "button");
    g.setAttribute("aria-label", label);
    g.setAttribute("aria-expanded", String(on));
    if (on) g.classList.add("sel");
    const act = () => ui.select(on ? null : key);
    g.addEventListener("click", act);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); } });
  };
  const sel = ui.sel && ui.panel ? rowOf(ui.sel) : null;
  const draw = (gapPx: number) => {
    const L = gitLayout(m, { width: wrap.clientWidth || GS_DEFAULT_WIDTH, gap: sel ? { after: sel, h: gapPx } : undefined });
    s.setAttribute("viewBox", `0 0 ${L.width} ${L.height}`);
    s.setAttribute("width", String(L.width));
    s.setAttribute("height", String(L.height));
    const named: [SVGTextElement, string, number][] = [];
    s.replaceChildren();
    for (const p of L.shapes) {
      if (p.t === "line") s.appendChild(svg("path", { d: `M${p.x1} ${p.y1} L${p.x2} ${p.y2}`, class: `gsl${p.open ? " open" : ""}` }));
      else if (p.t === "rect") {
        const g = svg("g", { class: `gsr ${p.kind}${p.live ? " live" : ""}${p.quiet ? " quiet" : ""}`, "data-head": p.key }, p.live ? `Live session · ${p.title}` : p.title);
        const t = Object.assign(svg("text", { x: p.x + 6, y: p.y + 4 }), { textContent: fit(p.text, p.w) });
        named.push([t, p.text, p.w - 12]);
        g.append(svg("rect", { x: p.x, y: p.y - RH / 2, width: p.w, height: RH, rx: 5 }), t);
        if (p.key !== "next") pressable(g, p.key, `${p.title} — click opens what belongs to it`);
        s.appendChild(g);
      } else if (p.t === "circle") {
        const g = svg("g", { class: `gsk${p.ses.active ? " on" : ""}`, "data-slot": p.ses.slot, "data-at": p.at, tabindex: 0,
          role: "button", "aria-label": `${cardLines(p.ses).join(" · ")} — Enter: go to the session` });
        const ses = p.ses;
        // a small circle keeps a finger-sized target: the hit box spans its step on the row
        g.append(svg("rect", { x: p.x - CSTEP / 2, y: p.y - 11, width: CSTEP, height: 22, class: "gshit" }), svg("circle", { cx: p.x, cy: p.y, r: p.r }));
        // the card on hover or focus; a click on a circle whose card stands jumps to its session — on the phone the
        // first tap shows the card (it was not standing at the touch), the second jumps
        let armed = false;
        g.addEventListener("mouseenter", () => show(g, ses));
        g.addEventListener("focus", () => show(g, ses));
        g.addEventListener("mouseleave", hide);
        g.addEventListener("blur", hide);
        g.addEventListener("pointerdown", () => { armed = !card.hidden && shownFor === ses.slot; });
        g.addEventListener("click", () => { if (armed) ui.jump(ses.slot); else show(g, ses); });
        g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ui.jump(ses.slot); } });
        s.appendChild(g);
      } else if (p.t === "diamond") {
        const older = p.older === undefined || p.older === null ? "" : ` · last checked ${p.older || "an older commit"}${p.older ? " (older commit)" : ""}`;
        const word = p.of === "next" && p.d === "none" ? NEXT_QUIET
          : p.d === "landed" ? CHECK_WORD.landed : `${CHECK_WORD[p.d]}${older}${p.merged ? " · landed" : " · not landed yet"}`;
        const g = svg("g", { class: "gsdg", "data-of": p.of }, `${p.of}: ${word}`);
        g.append(svg("rect", { x: p.x - 11, y: p.y - 11, width: 22, height: 22, class: "gshit" }),
          svg("path", { d: `M${p.x} ${p.y - p.r} L${p.x + p.r} ${p.y} L${p.x} ${p.y + p.r} L${p.x - p.r} ${p.y} Z`,
            class: `gsd ${p.d}${p.merged ? "" : " open"}`, "data-of": p.of }));
        if (p.of !== "next") pressable(g, `dia:${p.of}`, `Diamond of ${p.of.replace(/^[a-z]+:/, "")}: ${word} — click opens it`);
        s.appendChild(g);
      } else if (p.t === "ti") {
        const word = `Test instance running${p.port === null ? "" : ` · port ${p.port}`}`;
        const g = svg("g", { class: "gst", "data-of": p.of }, word);
        g.appendChild(svg("rect", { x: p.x, y: p.y - TI_SQ / 2, width: TI_SQ, height: TI_SQ, rx: 1.5 }));
        if (p.port !== null) g.appendChild(Object.assign(svg("text", { x: p.x + TI_SQ + 4, y: p.y + 3.5 }), { textContent: `:${p.port}` }));
        s.appendChild(g);
      } else s.appendChild(svg("circle", { cx: p.x, cy: p.y, r: 2.5, class: "gsp" }, p.title));
    }
    // what the estimate let through is measured once the drawing stands: the whole name where it fits, else cut with …
    if (s.isConnected) for (const [t, text, room] of named) {
      if (t.textContent === text && t.getComputedTextLength() <= room) continue;
      let n = text.length;
      t.textContent = text;
      while (n > 1 && t.getComputedTextLength() > room) t.textContent = `${text.slice(0, --n).trimEnd()}…`;
    }
    // the menu stands in the gap under its row, from its head's left edge to the column's right
    const at = sel ? L.shapes.find((p) => p.t === "rect" && p.key === sel) : undefined;
    if (ui.panel && at && at.t === "rect") {
      ui.panel.style.top = `${Math.round(at.y + RH / 2 + 5)}px`;
      ui.panel.style.left = `${Math.round(Math.max(0, at.x - 2))}px`;
    }
  };
  wrap.append(s, card);
  if (ui.panel) {
    ui.panel.classList.add("gsm");
    wrap.appendChild(ui.panel);
  }
  draw(0);
  // the gap follows the menu's height — also while it unfolds, so the rows below move with it — and the drawing the
  // column's width
  let unfolded = ui.fresh === null;
  const panel = ui.panel;
  const ro = new ResizeObserver(() => {
    if (!wrap.isConnected) return;
    if (panel && !unfolded) {
      unfolded = true;
      const part = ui.fresh === "step2" ? panel.querySelector<HTMLElement>(":scope > .gsm2") : panel;
      if (part && !matchMedia("(prefers-reduced-motion: reduce)").matches)
        part.animate([{ height: "0px", opacity: 0 }, { height: `${part.scrollHeight}px`, opacity: 1 }], { duration: UNFOLD_MS, easing: "ease-out" });
    }
    draw(panel ? panel.offsetHeight + 10 : 0);
  });
  ro.observe(wrap);
  if (panel) ro.observe(panel);
  box.appendChild(wrap);
  if (ui.below.length) box.append(...ui.below);
  // THE LEGEND under the structure, a quiet line that opens it
  const lg = document.createElement("button");
  lg.type = "button";
  lg.className = `gslegbtn${ui.info ? " on" : ""}`;
  lg.textContent = ui.info ? "Hide legend" : "What the signs mean";
  lg.setAttribute("aria-expanded", String(ui.info));
  lg.onclick = ui.toggleInfo;
  box.appendChild(lg);
  if (ui.info) {
    const ul = document.createElement("ul");
    ul.className = "gslegend";
    for (const sign of signsOf(gitLayout(m).shapes)) {
      const li = document.createElement("li");
      li.dataset.sign = sign;
      li.append(sample(sign), GS_LEGEND[sign]);
      ul.appendChild(li);
    }
    const li = document.createElement("li");
    li.className = "gshint";
    li.textContent = "Click a rectangle or a diamond to open what belongs to it.";
    ul.appendChild(li);
    box.appendChild(ul);
  }
  return box;
}

export const GS_CSS = `
  #board .gs { margin: 0 0 10px; }
  /* one line on the Mac and on Linux (its sans ran the + 3 px out of the section at 1200, dom on the workhorse; measured
     there at viele: 301 px of room, 302 filled before the side's gap went 4 → 2); when it still does not fit, the side
     wraps under the name — never past the edge, never cut (owner 2026-10-08) */
  #board .gsh { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 2px 4px; white-space: nowrap; }
  #board .gsside { display: inline-flex; align-items: center; gap: 2px; min-width: 0; margin-left: auto; }
  #board .gsf { display: inline-flex; align-items: center; gap: 4px; min-height: 32px; min-width: 32px; padding: 2px 4px 2px 8px; margin-left: -8px;
    border: 1px solid transparent; border-radius: 8px; background: none; color: var(--chat-ink); font: inherit; font-weight: 600; cursor: pointer; }
  #board .gsf:hover { background: var(--chat-surface); border-color: var(--chat-edge); }
  #board .gsf:focus-visible, #board .gslegbtn:focus-visible { outline: 2px solid var(--chat-ink); outline-offset: 2px; }
  #board .gsf .gsv, #board .gsf .gsc { color: var(--chat-mute); display: inline-block; font-size: 1.35em; line-height: 1; font-weight: 400; transition: transform 160ms ease; }
  #board .gs.open .gsf .gsv { transform: rotate(90deg); }
  @media (prefers-reduced-motion: reduce) { #board .gsf .gsv { transition: none; } }
  #board .gsf .gsn { font-weight: 700; }
  #board .gslegbtn { display: block; min-height: 32px; margin: 2px 0 0; padding: 0; border: 0; border-radius: 6px; background: none;
    color: var(--chat-faint); font: inherit; cursor: pointer; text-decoration: underline dotted; text-underline-offset: 3px; }
  #board .gslegbtn:hover, #board .gslegbtn.on { color: var(--chat-mute); }
  #board .gslegend { list-style: none; margin: 6px 0 4px; padding: 6px 8px; border: 1px solid var(--chat-edge); border-radius: 8px; }
  #board .gslegend > li { display: flex; align-items: center; gap: 8px; min-height: 20px; color: var(--chat-prose); }
  #board .gslegend > li.gshint { margin-top: 4px; color: var(--chat-mute); }
  #board .gslegend .gslg { flex: none; margin: 0; }
  #board .gsw { position: relative; }
  #board .gss { display: block; margin-top: 6px; overflow: visible; font-size: inherit; }
  #board .gss .gsl { fill: none; stroke: var(--chat-faint); stroke-width: 1.4; }
  #board .gss .gsl.open { stroke-dasharray: 4 3; }
  #board .gss .gsr { cursor: pointer; outline: none; }
  #board .gss .gsr rect { fill: var(--chat-surface); stroke: var(--chat-faint); stroke-width: 1.4; }
  /* main and next at every head's width, a step brighter than a branch and a step quieter than a selection — the white
     line stays the selection's (owner Z131: „[Zitat entfernt]“; 18.10. 23:4x: „[Zitat entfernt]“
     ) */
  #board .gss .gsr.main rect { stroke: var(--chat-mute); }
  #board .gss .gsr.live rect { stroke: var(--q-live); }
  #board .gss .gsr:hover rect { stroke: var(--chat-mute); }
  /* next while nothing is ready to land: grey, nothing to press */
  #board .gss .gsr.quiet { cursor: default; }
  #board .gss .gsr.quiet rect, #board .gss .gsr.quiet:hover rect { stroke: var(--chat-faint); }
  #board .gss .gsr.quiet text { fill: var(--chat-faint); }
  #board .gss .gsr.sel rect, #board .gss .gsr:focus-visible rect { stroke: var(--chat-ink); stroke-width: 2.2; }
  #board .gss .gsr text { fill: var(--chat-ink); font-size: inherit; pointer-events: none; }
  #board .gss .gsr.lane text { fill: var(--chat-mute); }
  #board .gss .gsr.lane.sel text { fill: var(--chat-ink); }
  #board .gss .gsk { cursor: pointer; outline: none; }
  #board .gss .gsk circle { fill: var(--chat-surface); stroke: var(--chat-mute); stroke-width: 1.4; }
  #board .gss .gsk.on circle { fill: var(--q-live); stroke: var(--q-live); }
  #board .gss .gsk:focus-visible circle { stroke: var(--chat-ink); stroke-width: 2; }
  #board .gss .gsp { fill: var(--chat-faint); }
  #board .gss .gshit { fill: transparent; stroke: none; }
  #board .gss .gsdg { cursor: pointer; outline: none; }
  #board .gss .gsd { fill: var(--chat-surface); stroke: var(--chat-mute); stroke-width: 1.4; }
  #board .gss .gsd.green { fill: var(--q-live); stroke: var(--q-live); }
  #board .gss .gsd.red { fill: var(--danger); stroke: var(--danger); }
  #board .gss .gsd.running, #board .gss .gsd.waiting { stroke: var(--q-live); }
  #board .gss .gsd.skipped { fill: var(--chat-mute); stroke: var(--chat-mute); }
  #board .gss .gsd.landed { fill: var(--q-live); stroke: var(--chat-faint); }
  #board .gss .gsdg.sel .gsd, #board .gss .gsdg:focus-visible .gsd { stroke: var(--chat-ink); stroke-width: 2.2; }
  #board .gss .gst rect { fill: var(--q-live); }
  #board .gss .gst text { fill: var(--chat-mute); font-size: inherit; font-family: var(--mono, monospace); }
  #board .gscard { position: absolute; z-index: 5; width: max-content; max-width: 220px; padding: 6px 9px; border: 1px solid var(--chat-edge);
    border-radius: 6px; background: var(--chat-surface); color: var(--chat-mute); font-size: 0.85em; line-height: 1.35; box-shadow: 0 4px 14px rgba(0,0,0,.35); }
  #board .gscard b { display: block; color: var(--chat-ink); font-weight: 600; }
  #board .gscard.on > div:nth-last-child(2) { color: var(--q-live); }
  #board .gscard > div:last-child { margin-top: 3px; color: var(--chat-faint); }
  #board .gsm { position: absolute; right: 0; z-index: 3; overflow: hidden; border: 1px solid var(--chat-edge); border-radius: 8px;
    background: var(--chat-surface); box-shadow: 0 6px 18px rgba(0,0,0,.28); }
  #board .gsm1 { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; }
  #board .gsm1 > .gshd { color: var(--chat-ink); font-weight: 600; overflow-wrap: anywhere; }
  /* a branch name moves to the next line whole; it breaks inside only where it is wider than the menu */
  #board .gsm1 > .gshd > .gsbn { display: inline-block; max-width: 100%; }
  #board .gsm1 > .gscap { color: var(--chat-mute); white-space: normal; overflow-wrap: anywhere; }
  #board .gsm1 > .gswords { display: flex; flex-wrap: wrap; gap: 6px; }
  #board .gsm1 .gsword { min-height: 32px; padding: 0 12px; border: 1px solid var(--chat-edge); border-radius: 16px; background: none;
    color: var(--chat-ink); font: inherit; cursor: pointer; }
  #board .gsm1 .gsword.acts { border-style: dashed; }
  #board .gsm1 .gsword.on { background: var(--chat-ink); border-color: var(--chat-ink); color: var(--chat-surface); }
  #board .gsm1 .gsword:focus-visible { outline: 2px solid var(--chat-ink); outline-offset: 2px; }
  #board .gsm1 .gsword:disabled { opacity: .45; cursor: default; }
  /* the test-instance line and the land form come from the Ranke; in the menu they stand left, one flowing line each */
  #board .gsm .gsm1 > .zd { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-start; gap: 6px 8px; min-height: 0;
    margin: 0; padding: 0; text-align: left; }
  #board .gsm .gsm1 > .zd > .tx { flex: 1 1 auto; min-width: 0; white-space: normal; }
  #board .gsm .gsm1 > .zd > .r { margin-left: auto; }
  #board .gsm .gsm1 > .zd.gsnoti { color: var(--chat-mute); }
  #board .gsm .gsm1 > .zd.lf-set > .lf-k { flex-basis: 100%; color: var(--chat-mute); }
  #board .gsm .gsm1 > .zd.lf-set .lf-c { min-height: 30px; padding: 0 12px; border: 1px solid var(--chat-edge); border-radius: 15px; }
  #board .gsm .gsm1 > .zd.lf-set .lf-c.on { background: var(--chat-ink); border-color: var(--chat-ink); color: var(--chat-surface); }
  /* a lane's own two forms stay together: where three do not fit, both go under „Like the project“ */
  #board .gsm .gsm1 > .zd.lf-set .lf-own { display: inline-flex; gap: 6px; }
  /* „Looks good“ stays beside its line, which wraps to its left */
  #board .gsm .gsm1 > .zd.brc-seen { flex-wrap: nowrap; }
  #board .gsm .gsm1 > .zd.brc-seen > .tx { flex: 1 1 0; }
  #board .gsm .gsfact { padding: 0; border: 0; background: none; color: var(--chat-ink); font: inherit; cursor: pointer;
    text-decoration: underline dotted; text-underline-offset: 3px; }
  #board .gsm .gsfact:focus-visible { outline: 2px solid var(--chat-ink); outline-offset: 2px; }
  #board .gsm2 { overflow: hidden; border-top: 1px solid var(--chat-edge); padding: 4px 2px 6px; }
  #board .gsm .gsm2 > .zd, #board .gsm .gsm2 > .zd.brc { padding-left: 10px; padding-right: 10px; }
  /* the way line starts at the menu's edge, not behind the old Ranke's rail */
  #board .gsm .gsm2 > .zd.wl > .tx { grid-column: 1 / -1; }
  #board .gs > .gsbelow { margin: 4px 0 0 34px; }
  /* THE GEAR'S PANEL under the head: a label left, its choices right — they wrap under it where the column is narrow */
  #board .gsh .gsgear.on { color: var(--chat-ink); background: var(--chat-surface); }
  #board .gsset { display: flex; flex-direction: column; gap: 6px; margin: 4px 0 6px; padding: 8px 10px; border: 1px solid var(--chat-edge);
    border-radius: 8px; background: var(--chat-surface); }
  #board .gsset > .zd.lf-set { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-start; gap: 6px 8px; min-height: 0;
    margin: 0; padding: 0; text-align: left; }
  #board .gsset > .zd.lf-set > .lf-k { flex: 0 1 auto; min-width: 0; color: var(--chat-prose); }
  #board .gsset > .zd.lf-set > .lf-i { margin-left: -6px; }
  #board .gsset > .zd.lf-set > .gsch { display: inline-flex; gap: 6px; margin-left: auto; }
  #board .gsset .gsch > .lf-c { min-height: 30px; padding: 0 10px; border: 1px solid var(--chat-edge); border-radius: 15px; }
  #board .gsset .gsch > .lf-c.on { background: var(--chat-ink); border-color: var(--chat-ink); color: var(--chat-surface); }
  #board .gsquiet { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 10px 0 4px; border: 0; border-radius: 8px;
    background: none; color: var(--chat-mute); font: inherit; cursor: pointer; }
  #board .gsquiet:hover { background: var(--chat-surface); }
  #board .gsquiet:focus-visible { outline: 2px solid var(--chat-ink); outline-offset: 2px; }
  #board .gsquiet > svg { transition: transform 160ms ease; }
  #board .gsquiet.zu > svg { transform: rotate(-90deg); }
`;
