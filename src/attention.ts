import { $, el, api, post, refresh, toast, setDrawer, fmtSince } from "./client";
import { PANE_ACK_STALE_MS, opsOpen, opsUnacked, opsSubject, opsSummary, type OpsPollRow } from "./opsevents";

// --- the attention inbox (📣): what a bound Program-MAIN raised for the OWNER — a decision, a
// block, something ready for review — and the one bound answer back. It lives OUTSIDE the compose
// box on purpose: an item that only ever appeared as pane text in one session is an item the owner
// can miss entirely, which is the failure this channel exists to remove.
//
// Its cost on the 2s poll is one number (attentionOpen). The rows come from GET /api/attention when
// this panel opens, and again when that number MOVES while it is open — never on a timer of its own.
// The interfaces below are LOCAL and describe exactly what the server emits; nothing here is cast
// onto the /api/sessions payload, which carries the count and nothing else.
interface AttentionRow {
  id: string; raisedAt: number; kind: "decision" | "blocked" | "review-ready"; text: string;
  requester: { slot: number; openedAt: number; sessionId: string | null };
  programId: string; programTitle: string | null;
  status: "open" | "send-uncertain" | "answered" | "refused";
  answer: ({ text: string; at: number } & ({ by: "owner" } | { by: "orchestrator"; slot: number })) | null;
  refusedReason: string | null; closedAt: number | null;
  // derived by the server at read time for an ANSWERED row, null otherwise (server.ts#attentionDelivery)
  delivery: AttentionDelivery | null;
}
type AttentionNudgeReading =
  | { outcome: "unknown"; why: string }
  | { outcome: "accepted"; at: number }
  | { outcome: "unobserved"; at: number; acceptance: string }
  | { outcome: "not-accepted"; at: number; failure: string; reason: string };
type AttentionDelivery =
  | { state: "read"; entryId: string; since: number; readAt: number; readBy: { slot: number } }
  | { state: "unread"; entryId: string; since: number; lastNudge: AttentionNudgeReading }
  | { state: "unknown"; why: string };
export let attndlg: HTMLElement;
let attnpanel: HTMLElement, attnbtn: HTMLElement;
let attentionOpen = 0;
export let attnRows: AttentionRow[] = [];
let attnErr: string | null = null;
let attnBusy = false;
// typed-but-unsent answers survive a repaint: the rows are rebuilt whenever the count moves, and
// losing a half-written answer to an unrelated arrival would be its own reason not to use this.
const attnDraft = new Map<string, string>();

function renderAttnBtn() {
  attnbtn.textContent = attentionOpen > 0 ? `📣${attentionOpen}` : "📣";
  attnbtn.classList.toggle("hot", attentionOpen > 0);
  // the affordance appears only when something is actually waiting — an always-present empty inbox
  // trains the eye to ignore it, and there is nothing to open when the count is zero
  attnbtn.style.display = attentionOpen > 0 || attndlg.style.display === "flex" ? "" : "none";
}

export function setAttentionOpen(n: number) {
  const moved = n !== attentionOpen;
  attentionOpen = n;
  renderAttnBtn();
  if (moved && attndlg.style.display === "flex") void loadAttention();
}

export async function loadAttention() {
  const res = await api("/api/attention");
  if (!res.ok) { attnErr = `could not load the inbox (${res.status})`; renderAttnDlg(); return; }
  const data = (await res.json()) as { requests?: AttentionRow[] };
  attnRows = data.requests ?? [];
  attnErr = null;
  renderAttnDlg();
}

export function closeAttnDlg() {
  attndlg.style.display = "none";
  renderAttnBtn();
}


const ATTN_KIND_TITLE: Record<AttentionRow["kind"], string> = {
  decision: "a decision only the owner can make",
  blocked: "the program is blocked until the owner acts",
  "review-ready": "something is ready for the owner to review",
};

function attnOpenRow(a: AttentionRow): HTMLElement {
  const row = el("div", `attnrow ${a.status === "send-uncertain" ? "uncertain" : "open"}`);
  const head = el("div", "attnhead");
  const chip = el("span", `attnkind k-${a.kind}`, a.kind);
  chip.title = ATTN_KIND_TITLE[a.kind];
  head.appendChild(chip);
  head.appendChild(el("span", "attnprog", a.programTitle ?? `program ${a.programId} (title not resolvable)`));
  head.appendChild(el("span", "attnmeta", `slot ${a.requester.slot} · ${fmtSince(a.raisedAt)}`));
  row.appendChild(head);
  row.appendChild(el("div", "attntext", a.text));
  if (a.status === "send-uncertain")
    row.appendChild(el("div", "attnwarn",
      "answer send unresolved — it may already be in the session's pane. Retry sends the identical text; a different answer is refused."));
  const ta = document.createElement("textarea");
  ta.className = "attnta";
  ta.rows = 3;
  // an unresolved send has exactly one legal answer: the pending text, byte for byte
  ta.value = a.status === "send-uncertain" ? (a.answer?.text ?? "") : (attnDraft.get(a.id) ?? "");
  ta.readOnly = a.status === "send-uncertain";
  ta.placeholder = "Your answer — it is delivered into that session's pane.";
  ta.addEventListener("input", () => attnDraft.set(a.id, ta.value));
  row.appendChild(ta);
  const btns = el("div", "shrbtns");
  const answer = el("button", "shrbtn primary",
    a.status === "send-uncertain" ? "retry send" : "answer") as HTMLButtonElement;
  answer.disabled = attnBusy;
  answer.onclick = async () => {
    const text = ta.value.trim();
    if (!text) { toast("an answer needs text"); return; }
    attnBusy = true;
    const res = await post(`/api/attention/${a.id}/answer`, { text });
    attnBusy = false;
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast(err.error ?? "the answer was not delivered");
    } else attnDraft.delete(a.id);
    await refresh();
    await loadAttention();
  };
  const refuse = el("button", "shrbtn", "refuse") as HTMLButtonElement;
  refuse.title = "dismiss without answering — the reason is the receipt that you saw it";
  refuse.disabled = attnBusy;
  refuse.onclick = async () => {
    const reason = prompt("Why are you declining this? (recorded on the row)")?.trim();
    if (!reason) return;
    attnBusy = true;
    const res = await post(`/api/attention/${a.id}/refuse`, { reason });
    attnBusy = false;
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast(err.error ?? "the refusal did not stick");
    }
    await refresh();
    await loadAttention();
  };
  btns.append(answer, refuse);
  row.appendChild(btns);
  return row;
}

function attnClosedRow(a: AttentionRow): HTMLElement {
  const row = el("div", `attnrow done ${a.status}`);
  const head = el("div", "attnhead");
  head.appendChild(el("span", `attnkind k-${a.kind}`, a.kind));
  head.appendChild(el("span", "attnprog", a.programTitle ?? `program ${a.programId}`));
  head.appendChild(el("span", "attnmeta", `${a.status} · ${fmtSince(a.closedAt ?? a.raisedAt)}`));
  row.appendChild(head);
  const outcome = a.status === "answered" ? a.answer?.text ?? "" : a.refusedReason ?? "";
  const line = el("div", "attnclosed", `${a.text} → ${outcome}`);
  line.title = outcome;
  row.appendChild(line);
  if (a.delivery) row.appendChild(attnDeliveryLine(a.delivery));
  return row;
}

// The answer is a Program inbox pointer, never a paste — so "answered" says nothing about whether
// the MAIN has it. This line says what the server can prove, and "unknown" where it cannot.
function attnDeliveryLine(d: AttentionDelivery): HTMLElement {
  if (d.state === "read")
    return el("div", "hint shrhint", `read by slot ${d.readBy.slot} · ${fmtSince(d.readAt)}`);
  if (d.state === "unknown") return el("div", "attnwarn", `delivery unknown — ${d.why}`);
  const n = d.lastNudge;
  const nudge = n.outcome === "unknown" ? `last nudge unknown (${n.why})`
    : n.outcome === "accepted" ? `last nudge accepted ${fmtSince(n.at)}`
    : n.outcome === "unobserved" ? `last nudge typed, acceptance ${n.acceptance} ${fmtSince(n.at)}`
    : `last nudge NOT accepted ${fmtSince(n.at)}: ${n.reason}`;
  return el("div", n.outcome === "accepted" ? "hint shrhint" : "attnwarn", `unread since ${fmtSince(d.since)} · ${nudge}`);
}

function renderAttnDlg() {
  attnpanel.replaceChildren();
  attnpanel.appendChild(el("h2", "", "Attention — raised by a program's main session"));
  if (attnErr) attnpanel.appendChild(el("div", "attnwarn", attnErr));
  const live = attnRows.filter((a) => a.status === "open" || a.status === "send-uncertain");
  const closed = attnRows.filter((a) => a.status === "answered" || a.status === "refused");
  if (!live.length) attnpanel.appendChild(el("div", "hint shrhint", "Nothing is waiting on you."));
  for (const a of live) attnpanel.appendChild(attnOpenRow(a));
  if (closed.length) {
    attnpanel.appendChild(el("div", "attnsep", "settled"));
    for (const a of closed) attnpanel.appendChild(attnClosedRow(a));
  }
  const btns = el("div", "shrbtns");
  const close = el("button", "shrbtn", "close") as HTMLButtonElement;
  close.onclick = closeAttnDlg;
  btns.appendChild(close);
  attnpanel.appendChild(btns);
}



// --- the OPERATIONS inbox (📥): FleetEvents whose subscription asked for delivery:"inbox" instead
// of pane text. STRICTLY SEPARATE from 📣 above and never merged with it: that inbox carries what
// needs an owner DECISION, this one carries completion FACTS an owner-attended session subscribed
// to — a merge outcome, a post-land audit, a deploy, a lane reaching a completion predicate.
// Acknowledging is a receipt that the owner saw it, nothing else; it starts no work.
//
// No request of its own: the 2 s poll carries exactly the rows this panel can show, projected to
// the fields it prints (src/opsevents.ts#opsPollRow). Every other row — terminal, receiver-gone,
// and the inbox reports the section below loads itself — lives behind GET /api/events.
export let opsdlg: HTMLElement;
let opspanel: HTMLElement, opsbtn: HTMLElement;
export let opsRows: OpsPollRow[] = [];
let opsBusy = false;

// --- the THIRD class in this panel, and the one whose rows are not events at all: worker reports
// that no session can judge any more. A bound report's FleetEvent goes `receiver-gone` the moment
// its MAIN is torn down — terminal, and therefore in NEITHER class above (opsOpen wants an inbox
// row, opsUnacked wants a live pane debt). The row was the owner's to settle and nothing showed it
// to him, which is why a fleet accumulated panes: retiring a MAIN with an unjudged report made the
// verdict permanently unreachable instead of merely inconvenient.
//
// It costs one number on the 2s poll (`reportsAwaitingOwner`); the rows come from
// GET /api/fleet-report when this panel opens and again when that number MOVES while it is open —
// the attention panel's rule exactly, for its reason.
interface OwnerReportRow {
  id: string; reportedAt: number; status: "complete" | "needs-main" | "failed" | "handoff"; text: string;
  worker: { slot: number; openedAt: number; sessionId: string | null; cwd: string; branch: string };
  provenance: { taskId: string | null; originId: string | null; programId: string | null;
    instance?: string | null };
  receiver: { slot: number; openedAt: number; sessionId: string | null } | null;
  basis: "program-main" | "lane-watch" | "program-main+lane-watch" | "owner-inbox" | "program";
  eventId: string | null;
  // derived server-side per request from the one rule both decision doors read
  liveness: "live" | "gone" | "owner-inbox";
  decision?: { disposition: "accepted" | "rejected"; at: number;
    by: { slot: number; openedAt: number; sessionId: string | null } | "owner";
    reason: string | null } | null;
  // server/types.ts#FleetReport.outsideSurface — null/absent = not measured, [] = nothing outside
  outsideSurface?: string[] | null;
}
let reportsAwaitingOwner = 0;
export let ownerReportRows: OwnerReportRow[] = [];
let ownerReportErr: string | null = null;
// typed-but-unsent reasons survive a repaint, for attnDraft's reason: the rows are rebuilt whenever
// the count moves, and losing a half-written reason to an unrelated arrival is its own deterrent.
const ownerReportDraft = new Map<string, string>();
const ownerReportAwaiting = (r: OwnerReportRow): boolean => !r.decision && r.liveness !== "live";

// EVERY inbox row EXCEPT a worker report. The report rail counts its own rows and renders them in
// its own section below, and it counts BOTH carriers — the owner-inbox row that arrives here as an
// inbox event, and the orphaned bound row whose event went terminal on teardown and arrives here as
// nothing at all. Leaving fleet-report rows in this class would count the first kind twice and show
// it in two places, with an `acknowledge` button beside a `reject` one for the same row.
const opsOpenNonReport = (rows: OpsPollRow[]): OpsPollRow[] =>
  opsOpen(rows).filter((e) => e.kind !== "fleet-report");

function renderOpsBtn() {
  // FILED FOR THE OWNER, one meaning, two carriers: an inbox event of any other kind, and a worker
  // report no session can judge. Both are rows that want the OWNER to close them, so they are one
  // number — this is not the forbidden sum below, which would add a count that wants nobody.
  const n = opsOpenNonReport(opsRows).length + reportsAwaitingOwner;
  // TWO NUMBERS, NEVER A SUM. Filed operations want the owner to close them; unacknowledged pane
  // transport wants nobody — it is a report. Adding them would make one count mean two things.
  const m = opsUnacked(opsRows, Date.now()).length;
  opsbtn.textContent = `📥${n > 0 ? n : ""}${m > 0 ? ` ⚠${m}` : ""}`;
  opsbtn.classList.toggle("hot", n > 0);
  opsbtn.title = `${n} filed for you (${reportsAwaitingOwner} worker report(s) no session can judge)`
    + ` · ${m} pane event(s) sent without a session acknowledgement`;
  // same rule as 📣: no affordance while nothing is filed, so the icon means something when it appears
  opsbtn.style.display = n > 0 || m > 0 || opsdlg.style.display === "flex" ? "" : "none";
}

export function setOpsEvents(rows: OpsPollRow[]) {
  opsRows = rows;
  renderOpsBtn();
  if (opsdlg.style.display === "flex") renderOpsDlg();
}

export function setReportsAwaitingOwner(n: number) {
  const moved = n !== reportsAwaitingOwner;
  reportsAwaitingOwner = n;
  renderOpsBtn();
  if (moved && opsdlg.style.display === "flex") void loadOwnerReports();
}

export async function loadOwnerReports() {
  const res = await api("/api/fleet-report");
  if (!res.ok) { ownerReportErr = `could not load the reports (${res.status})`; renderOpsDlg(); return; }
  const data = (await res.json()) as { reports?: OwnerReportRow[] };
  ownerReportRows = data.reports ?? [];
  ownerReportErr = null;
  renderOpsDlg();
}

export function closeOpsDlg() {
  opsdlg.style.display = "none";
  renderOpsBtn();
}


// who this row is FOR. Slot-bound rows name their receiver occupant; an owner row names nobody,
// because nobody is what it has — saying „[Zitat entfernt]“ would read as a lost binding.
function opsReceiver(e: OpsPollRow): string {
  return e.receiverSlot === null ? "filed for you" : `receiver slot ${e.receiverSlot}`;
}

function opsRow(e: OpsPollRow): HTMLElement {
  const row = el("div", "attnrow open");
  const head = el("div", "attnhead");
  // a worker report carries its own verdict, so the chip shows it: a `failed` and a `complete`
  // must not look alike in a list the owner scans.
  const status = String((e.payload ?? {}).status ?? "");
  const chip = e.kind !== "fleet-report" ? "k-review-ready"
    : status === "failed" ? "k-blocked" : status === "needs-main" ? "k-decision"
      : status === "handoff" ? "k-handoff" : "k-review-ready";
  head.appendChild(el("span", `attnkind ${chip}`, e.kind));
  head.appendChild(el("span", "attnprog", opsSubject(e)));
  head.appendChild(el("span", "attnmeta", `${opsReceiver(e)} · ${fmtSince(e.createdAt)}`));
  row.appendChild(head);
  row.appendChild(el("div", "attntext", opsSummary(e)));
  const btns = el("div", "shrbtns");
  const ack = el("button", "shrbtn primary", "acknowledge") as HTMLButtonElement;
  ack.title = "a receipt that you saw this — it starts nothing and changes no lane";
  ack.disabled = opsBusy;
  ack.onclick = async () => {
    opsBusy = true;
    const res = await post(`/api/events/${e.id}/ack`, {});
    opsBusy = false;
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast(err.error ?? "the acknowledgement did not stick");
    }
    await refresh();
    renderOpsDlg();
  };
  btns.appendChild(ack);
  row.appendChild(btns);
  return row;
}

// PLACED AHEAD OF THE READ-ONLY TRANSPORT ROW ON PURPOSE, and it must stay ahead of it:
// e2e/watch.ts proves that row by slicing this file between the two definitions that bracket it
// and asserting the window holds no ack, no post and no "failed". A row with buttons sitting
// inside that window fails those checks as if the read-only row had grown affordances — measured
// on the first run of this cut. (The probe now anchors on a line start, so this paragraph can
// name neither definition without becoming the slice itself — which is how it broke the second
// time. Both halves of that lesson are load-bearing.)
//
// One awaiting report, with the two acts that were missing. The verdict is the OWNER'S — the row
// says so, and the panel says so — because the MAIN it was filed to is gone; stamping it as that
// MAIN's would record a judgement by a session that had already ended.
function ownerReportRowEl(r: OwnerReportRow): HTMLElement {
  const row = el("div", "attnrow open");
  const head = el("div", "attnhead");
  // a `handoff` is the one status that reports no verdict at all: the lane is still running, one
  // session further on. Its own chip, so an owner scanning this list never reads a baton as a
  // finished slice (green) — the two ask for entirely different things from him, which is nothing
  // and a look, respectively.
  const chip = r.status === "failed" ? "k-blocked" : r.status === "needs-main" ? "k-decision"
    : r.status === "handoff" ? "k-handoff" : "k-review-ready";
  if (r.basis === "program") head.appendChild(el("span", "attnkind", "Program"));
  head.appendChild(el("span", `attnkind ${chip}`, r.status));
  head.appendChild(el("span", "attnprog", `slot ${r.worker.slot} · ${r.worker.branch}`));
  head.appendChild(el("span", "attnmeta", `${fmtSince(r.reportedAt)}`));
  row.appendChild(head);
  // WHY THIS ROW IS HERE AT ALL, stated rather than left to be inferred from an empty receiver
  // field: an absence that looks like "nobody has looked at it" is the state this section removes.
  row.appendChild(el("div", "hint shrhint", r.basis === "program"
    ? `Filed to Program ${r.provenance.programId}; it currently has no live bound MAIN, so the owner may judge it.`
    : r.liveness === "owner-inbox"
      ? "Filed to you directly — the lane had no coordinating session to report to."
      : `Filed to slot ${r.receiver?.slot}, whose session has since ended. No session can judge it any more.`));
  row.appendChild(el("div", "attntext", r.text));
  if (r.outsideSurface?.length)
    row.appendChild(el("div", "hint shrhint", `Committed outside the card's write surface: ${r.outsideSurface.join(", ")}`));
  const ta = document.createElement("textarea");
  ta.className = "attnta";
  ta.rows = 2;
  ta.value = ownerReportDraft.get(r.id) ?? "";
  ta.placeholder = "Reason (optional) — it is recorded on the row, not sent anywhere.";
  ta.addEventListener("input", () => ownerReportDraft.set(r.id, ta.value));
  row.appendChild(ta);
  const btns = el("div", "shrbtns");
  for (const verdict of ["accept", "reject"] as const) {
    const b = el("button", `shrbtn${verdict === "accept" ? " primary" : ""}`, verdict) as HTMLButtonElement;
    b.title = "your verdict, recorded as the owner's — this records a judgement and starts nothing";
    b.disabled = opsBusy;
    b.onclick = async () => {
      opsBusy = true;
      const text = (ownerReportDraft.get(r.id) ?? "").trim();
      const res = await post(`/api/fleet-report/${r.id}/${verdict}`, text ? { reason: text } : {});
      opsBusy = false;
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast(err.error ?? "the verdict did not stick");
      } else ownerReportDraft.delete(r.id);
      await refresh();
      await loadOwnerReports();
    };
    btns.appendChild(b);
  }
  row.appendChild(btns);
  return row;
}

// the read-only twin of opsRow: same facts, no affordance. It carries no acknowledge button because
// the owner is not the principal who could have read the pane text, and the server refuses him here.
function opsUnackedRow(e: OpsPollRow, now: number): HTMLElement {
  const row = el("div", "attnrow uncertain");
  const head = el("div", "attnhead");
  head.appendChild(el("span", "attnkind", e.kind));
  head.appendChild(el("span", "attnprog", opsSubject(e)));
  const since = e.deliveredAt ?? e.createdAt;
  head.appendChild(el("span", "attnmeta", `${opsReceiver(e)} · ${fmtSince(since)} without an ack`));
  row.appendChild(head);
  // THE TWO STATES KNOW DIFFERENT AMOUNTS, so both lines branch, headline and detail alike. A
  // `delivered` row knows tmux took the keystrokes and nothing beyond that. A `send-uncertain` row
  // does not even know that: it is persisted BEFORE tmux is touched, so whether a send was ever
  // accepted is itself unknown. Saying "tmux took the keystrokes" on that row would be a false
  // statement of the one fact this whole class exists to stop overstating.
  const uncertain = e.status === "send-uncertain";
  const secs = Math.round((now - since) / 1000);
  row.appendChild(el("div", "attntext", uncertain
    ? `transport outcome uncertain; recovery ${e.recovery?.state ?? "unavailable"}`
    : "transport reported sent; no session acknowledgement"));
  if (uncertain && e.recovery) {
    row.appendChild(el("div", "hint shrhint", `state: ${e.recovery.state}`));
    row.appendChild(el("div", "hint shrhint", `next: ${e.recovery.nextAction}`));
    row.appendChild(el("div", "hint shrhint", `reason: ${e.recovery.reason}`));
    row.appendChild(el("div", "hint shrhint", `effect: ${e.recovery.effect}`));
  } else {
    row.appendChild(el("div", "hint shrhint", uncertain
      ? `Recorded uncertain ${secs}s ago, before Fleet could prove whether tmux accepted anything. The `
        + "text may or may not be in the pane, and no session acknowledgement has arrived either way."
      : `tmux took the keystrokes ${secs}s ago. Whether the session read them is not known — only its `
        + "own acknowledgement can say so, and none has arrived."));
  }
  return row;
}

function renderOpsDlg() {
  opspanel.replaceChildren();
  opspanel.appendChild(el("h2", "", "Operations — completions filed instead of typed into a pane"));
  const live = opsOpenNonReport(opsRows);
  const awaiting = ownerReportRows.filter(ownerReportAwaiting);
  if (!live.length && !awaiting.length && reportsAwaitingOwner === 0)
    opspanel.appendChild(el("div", "hint shrhint", "Nothing is filed."));
  for (const e of live) opspanel.appendChild(opsRow(e));
  if (reportsAwaitingOwner > 0 || awaiting.length) {
    opspanel.appendChild(el("h2", "", "Worker reports no session can judge — your verdict"));
    opspanel.appendChild(el("div", "hint shrhint",
      "Either the MAIN each of these was filed to is gone, or none was ever bound — so the acceptance "
      + "door inside a session is closed for good. Accepting or rejecting here is recorded as YOUR "
      + "decision, not as that MAIN's; it moves no task, lands nothing and closes no lane."));
    if (ownerReportErr) opspanel.appendChild(el("div", "hint shrhint", ownerReportErr));
    else if (!awaiting.length) opspanel.appendChild(el("div", "hint shrhint", "Loading…"));
    for (const r of awaiting) opspanel.appendChild(ownerReportRowEl(r));
  }
  const now = Date.now();
  const unacked = opsUnacked(opsRows, now);
  if (unacked.length) {
    opspanel.appendChild(el("h2", "",
      "Pane transport without a session acknowledgement — a report, nothing to close"));
    opspanel.appendChild(el("div", "hint shrhint",
      `Sent into a pane over ${Math.round(PANE_ACK_STALE_MS / 1000)}s ago and still unacknowledged by `
      + "the receiving session. These rows are read-only here: the server-owned recovery state names any next action."));
    for (const e of unacked) opspanel.appendChild(opsUnackedRow(e, now));
  }
  const btns = el("div", "shrbtns");
  const close = el("button", "shrbtn", "close") as HTMLButtonElement;
  close.onclick = closeOpsDlg;
  btns.appendChild(close);
  opspanel.appendChild(btns);
}




export function initAttention(): void {
  attndlg = $("attndlg"); attnpanel = $("attnpanel"); attnbtn = $("attnbtn");
  opsdlg = $("opsdlg"); opspanel = $("opspanel"); opsbtn = $("opsbtn");
  attndlg.addEventListener("click", (e) => {
    if (e.target === attndlg) closeAttnDlg();
  });
  opsdlg.addEventListener("click", (e) => {
    if (e.target === opsdlg) closeOpsDlg();
  });
  attnbtn.onclick = () => {
    setDrawer(false);
    attndlg.style.display = "flex";
    renderAttnDlg();
    void loadAttention();
  };
  renderAttnBtn();
  opsbtn.onclick = () => {
    setDrawer(false);
    opsdlg.style.display = "flex";
    renderOpsDlg();
    // the rows, never on a timer: the count on the poll is what says whether there is anything to load
    if (reportsAwaitingOwner > 0) void loadOwnerReports();
  };
  renderOpsBtn();
}
