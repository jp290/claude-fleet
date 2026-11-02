import { $, el, ta, fleet, panes, setLayout, laneLabel, isMobile, baseName, type SlotInfo } from "./client";
import { icon } from "./icons";

// --- THE OWNER'S OWN BOT PAGE ----------------------------------------------------------------------------------
// Owner 2026-11-01: „[Zitat entfernt]“. Address /bot (server/transport.ts#STATIC serves the board's shell there; the answer for /bot
// (server/transport.ts#staticResponse) carries html.botpage, so no board chrome ever paints). It is NOT a second chat: the pane's
// conversation view and the one composer, with the rest folded away by CSS (index.html, "THE OWNER'S OWN BOT PAGE").
//
// WHICH SEAT: the one the owner marked — the right `owner.bot`, which only he gives (POST /api/slots/<n>/rechte, the
// switch in Info → Setup) and which a succession carries (SlotInfo.ownBot on the poll). `/bot?slot=N` names one;
// plain /bot takes the lowest marked seat. Nothing marked or the seat gone: the page says so, with the way back.
//
// THE BOARD IS NOT TOUCHED: saveView is silent on this page (client.ts), so fleet.view keeps the board's panes.
// The way back is a plain link to "/".

const isPage = (): boolean => location.pathname === "/bot";
export const isBotPage = isPage;
let on = false;
export const botOn = (): boolean => on;

// the animation is shown at least this long, so a fast read does not make it a flicker; after STUCK_MS it says it is slow
const VEIL_MIN_MS = 1400, STUCK_MS = 12_000;
let veil: HTMLElement, veilName: HTMLElement, veilMsg: HTMLElement, barName: HTMLElement;
let slot = 0, shownAt = 0, ended = false;

const markedSeat = (): SlotInfo | undefined => {
  const asked = Number(new URLSearchParams(location.search).get("slot"));
  return fleet.find((s) => s.cwd && s.ownBot && s.id === asked) ?? fleet.find((s) => s.cwd && s.ownBot);
};

export function initBot(): void {
  on = true;
  veil = $("botveil"); veilName = $("botveilname"); veilMsg = $("botveilmsg");
  barName = $("botname");
  const back = $("botback");
  back.replaceChildren(icon("back"), el("span", "", "Board"));
  $("botveilback").textContent = "Back to the board";
  veilMsg.textContent = "Opening your bot…";
  shownAt = Date.now();
  setTimeout(() => { if (!ended) { veilMsg.textContent = "This takes longer than usual."; veil.classList.add("stuck"); } }, STUCK_MS);
  const s = markedSeat();
  if (!s) { stop("No bot is marked yet.", "Mark yours in Info → Setup."); return; }
  slot = s.id;
  veilName.textContent = laneLabel(s);
  open();
  // the veil lifts once the conversation has been read, not before the minimum
  const wait = setInterval(() => {
    if (!panes[0]?.chatReady) return;
    clearInterval(wait);
    setTimeout(() => { ended = true; veil.classList.add("done"); if (!isMobile()) ta.focus(); }, Math.max(0, VEIL_MIN_MS - (Date.now() - shownAt)));
  }, 100);
}

function open(): void {
  setLayout(1, [slot]);
  panes[0]?.setView("chat");
}

// the page is final: a sentence and the way back
function stop(first: string, second: string): void {
  ended = true;
  veilName.textContent = first;
  veilMsg.textContent = second;
  veil.classList.add("stuck", "stopped");
}

// called on every poll (client.ts#updateTitle): the name follows a rename; a seat that went away or lost its mark is said, not shown empty
export function syncBot(): void {
  if (!on || !slot) return;
  const s = fleet.find((x) => x.id === slot);
  if (!s?.cwd || !s.ownBot) {
    veil.classList.remove("done");
    stop("Your bot is not running.", "Start it or mark it again on the board.");
    return;
  }
  const name = laneLabel(s);
  if (barName.textContent !== name) barName.textContent = name;
  document.title = name;
  showWhere(s);
}

// where the bot works, under the input: the folder, and the branch when there is one — as the board's foot line shows
// the branch (src/board.ts#renderWorkplaceField); a linked worktree names its repository, not the worktree's folder
function showWhere(s: SlotInfo): void {
  const box = $("botwhere");
  const dir = baseName(s.worktree?.repo ?? s.repo ?? s.cwd!);
  const branch = s.worktree?.branch ?? s.git?.branch ?? null;
  const key = `${dir}|${branch ?? ""}`;
  if (box.dataset.key === key) return;
  box.dataset.key = key;
  box.replaceChildren(el("span", "wtname", dir), ...(branch ? [el("span", "wtsep", "·"), el("span", "wtref", branch)] : []));
  box.title = branch ? `${dir} on ${branch}` : dir;
  box.hidden = false;
}

// the panes were rebuilt (crossing the phone breakpoint): the conversation view again
export function botReapply(): void {
  if (on && slot) open();
}

