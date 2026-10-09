// the suite meter's model, kept out of client.ts so it can be run without a DOM (e2e/outcomes.ts
// calls suiteMeter directly, the same way it calls postLandAlarm).
//
// The meter is the board's always-on answer to "what is verifying right now, and for whom". Every
// suite the fleet knows about becomes ONE ball, and a ball sits at the station its run is at:
//   wait   — asked for, not started: a lane's own "waiting", an offer no helper took, a land whose
//            post-land audit is folded into the next run
//   run    — running on THIS box: a lane's own "running", a server run, the post-land audit, or an
//            unnamed holder of the suite mutex
//   helper — running on a helper device: a claimed offer, a helper-held audit
//   done   — finished in the last few minutes (the server's own linger windows): green, red, unknown
// Nothing here is new data. Each ball cites the one wire row it came from, and two rows are never
// merged into one ball — a lane that reported its own run AND handed an offer to a helper shows two.

import type { PostLandAuditLiveInfo, SuiteOfferRow } from "./protocol";

export type MeterStation = "wait" | "run" | "helper" | "done";
export const METER_STATIONS: readonly MeterStation[] = ["wait", "run", "helper", "done"];
export type MeterTone = "plain" | "ok" | "red" | "unknown" | "warn";
export interface MeterBall {
  key: string;             // stable across polls, so the same run can MOVE between stations
  station: MeterStation;
  slot: number | null;     // null = fleet's own work (the audit) or a holder nobody named
  name: string;            // who: the lane, said the way the sidebar says it
  branch: string | null;
  // WHAT KIND OF RUN, as one fixed owner word (G0.5): „[Zitat entfernt]“, „[Zitat entfernt]“, „[Zitat entfernt]“ —
  // never the raw wire label („[Zitat entfernt]“). Where the name already says it (the slotless audit
  // balls), the row draws it once.
  kind: string;
  what: string;            // how far it is: the suite it is in, a position, a tree — "" when nothing is known
  // WHERE IT RUNS, as a place a reader can go to: this fleet's own instance name (or "this
  // machine" when the operator never named it) for everything on this box, and the DEVICE name for
  // anything a helper took. It is its own field and not a tail on `what` because it must never be
  // the part that gets truncated — "which machine is this running on" is the question the station
  // alone could only half answer, and a ball waiting for a helper has no place yet ("no helper
  // yet"), which is a different answer from "here".
  where: string;
  tone: MeterTone;
  at: number;              // when this row last changed state (server clock); 0 = not known
  // the distribution of past runs of THIS kind, where one exists on the wire — null otherwise, and
  // then the row draws no expectation at all rather than a "~0:00" nobody measured
  expect: { n: number; p50: number; p90: number } | null;
  // how many runs on a machine this ball stands for — absent is one. A sharded audit is ONE ball
  // and several runs, and the helper station counts runs, the way the device's own `running` does.
  runs?: number;
  // the lane's full derived title, for the tooltip — the name carries only its cut
  title?: string | null;
}
export type MeterLock = "free" | "held" | "overdue" | "parked" | "stale" | "unknown" | null;
export interface Meter { balls: MeterBall[]; lock: MeterLock }

// the wire shapes, restated structurally: client.ts owns GateInfo and HelperDeviceInfo, and this
// module takes only the fields it reads so the e2e caller can hand it plain objects.
export interface MeterGate {
  lock: { pid: number | null; alive: boolean | null; state?: string; acquiredAt?: number | null;
    owner?: { slot: number | null; branch: string } } | null;
  // the wrappers' ticket line at the mutex (server.ts#suiteQueueView). Optional for the usual
  // wire-tolerance reason: an older server sends none, and absent must read as "not reported",
  // never as "nobody is waiting".
  queue?: { n: number; pid: number; alive: boolean; sinceMs: number | null; position: number;
    owner?: { slot: number | null; branch: string } }[];
  reports: { slot: number | null; label: string | null; phase: string; suite: string;
    exitCode: number | null; at: number; origin?: string; branch?: string | null;
    // a server land row's suite ("security (2/3)") and its chain's past durations (server.ts#gateStats)
    stage?: string; stats?: { n: number; p50: number; p90: number } }[];
}
// a claim as server.ts#helperDevicesView serves it; a `command` claim (a gate script a session handed
// to that machine) also names the offering slot and the script
export interface MeterDevice { name: string; claims?: { kind?: string; repo: string; ref: string; claimedAt?: number; expiresAt: number;
  slot?: number; cmd?: string }[] }
// `title`: the lane's full derived title (laneTitleOf), absent or null when none could be derived
export interface MeterSlot { id: number; label: string | null; branch: string | null; letter?: string | null; title?: string | null }
export interface MeterInput {
  // what THIS fleet calls itself (FLEET_INSTANCE). null = the operator named none, and the meter
  // then says "this machine" rather than inventing a name two hosts could share.
  instance: string | null;
  gate: MeterGate | null;
  audit: PostLandAuditLiveInfo | null;
  offers: SuiteOfferRow[];
  devices: MeterDevice[];
  slots: MeterSlot[];
}

// Auto fleet branches end in four hex after either a timestamp or a date and task slug, so
// an unlabelled lane is named by them rather than by a prefix every lane shares.
export function laneTail(branch: string): string {
  const m = /-([0-9a-f]{4})$/.exec(branch);
  return m ? m[1] : branch.replace(/^fleet\//, "");
}

// WHAT A TASK LANE IS FOR, in words (owner 2026-09-29, 37439a62: „[Zitat entfernt]“
// ; cdf43028: „[Zitat entfernt]“).
// DERIVED on every read from the founding task and never stored: the card's goal first — its leading
// [TITEL] bracket when it opens with one, otherwise its first sentence — and only without a goal the
// task text's own leading [TITEL]. null = nothing to derive from, and every reader then names the
// lane exactly as before (the band name alone). The server ships the full title (server.ts, the
// /api/sessions slot row `taskTitle`); the board cuts it with shortTitle.
export const LANE_TITLE_MAX = 32;
export function laneTitleOf(ziel: string | null | undefined, text: string | null | undefined): string | null {
  const bracket = (s: string): string | null => /^\[([^\]\n]+)\]/.exec(s)?.[1]?.trim() || null;
  const goal = (ziel ?? "").trim();
  const title = goal
    ? bracket(goal) ?? goal.split("\n")[0]!.split(/(?<=[.!?])\s/)[0]!.replace(/[.!?]$/, "").trim()
    : bracket((text ?? "").trim());
  return title ? title.slice(0, 160) : null;
}
// ~32 characters with an ellipsis, in calm case (calmCase); the full title, as written, stays in the tooltip
export function shortTitle(title: string): string {
  const calm = calmCase(title);
  return calm.length <= LANE_TITLE_MAX ? calm : `${calm.slice(0, LANE_TITLE_MAX - 1).trimEnd()}…`;
}

// A SHOUTED [TITEL] IN SENTENCE CASE (owner 02.10.: „[Zitat entfernt]“ reads like shouting). Only a
// word written in capitals is touched: it goes to lower case, and the first word of the title and of
// every "·"/"—" part starts upper case again, as does a hyphen part behind an upper-case one
// ("FLEET-BETRIEB" → "Fleet-Betrieb", "MAIN-WAHL" → "MAIN-Wahl"). Kept as written: any word with a
// digit ("I1", "S5b-3p", "30.09.„[Zitat entfernt]“/" („[Zitat entfernt]“), and the short
// abbreviations below. A mixed-case word ("ersetzt", "e7ded380", "Program") is never changed.
// Display only, like the cut: the server's taskTitle stays the card's own words.
const CALM_KEEP = new Set(["MAIN", "MAINS", "UI", "UX", "API", "CLI", "TUI", "PR", "CI", "SSH", "JSON", "HTTP", "URL",
  "HTML", "CSS", "MCP", "GLM", "LLM", "ID", "IDS", "PID", "SHA", "DB", "OS", "PDF", "CPU", "GPU", "OK", "QA", "DOM", "CDP"]);
export function calmCase(title: string): string {
  let start = true;
  return title.split(" ").map((word) => {
    if (word === "") return word;
    if (/^[·—–|]$/.test(word)) { start = true; return word; }
    let upper = start;
    const out = word.split("-").map((part, i) => {
      const m = /^([(„"'“]*)(\p{Lu}[\p{Lu}ß]+)([)\],.;:!?"“”']*)$/u.exec(part);
      const shouted = !!m && !CALM_KEEP.has(m[2]);
      const first = i === 0 ? start : upper;
      if (!shouted) { upper = /^[(„"'“]*(\p{Lu}|\d)/u.test(part); return part; }
      const low = m[2].toLowerCase();
      upper = first;
      return `${m[1]}${first ? low.charAt(0).toUpperCase() + low.slice(1) : low}${m[3]}`;
    }).join("-");
    start = /:$/.test(word);
    return out;
  }).join(" ");
}
// "<Lane-Referenz> · <Kurztitel>", and the reference alone when no title could be derived
export function laneDisplayName(ref: string, title: string | null | undefined): string {
  return title ? `${ref} · ${shortTitle(title)}` : ref;
}

// m:ss — a clock someone is watching, so whole minutes would look frozen. Clamped: `at` is a server
// timestamp against this device's clock, and a phone a few seconds ahead must read 0:00.
export function mmss(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function meterKind(kind: string): { label: string; title: string } {
  switch (kind) {
    case "land check": return { label: "Landprüfung", title: "Prüft eine Lane, bevor ihre Änderung auf main landet." };
    case "preview": return { label: "Vorschau", title: "Prüft den aktuellen Stand einer Lane vor dem Land." };
    case "post-land check": return { label: "Nachprüfung", title: "Prüft main nach einem Land erneut." };
    case "queued check run": return { label: "Wartender Prüflauf", title: "Dieser Prüflauf wartet auf die gemeinsame Sperre." };
    case "gate script": return { label: "Gate-Skript", title: "Ein Gate-Skript (clean-review, security, claude-gate), das eine Session an ein Helfer-Gerät abgegeben hat." };
    default: return { label: "Prüflauf", title: "Ein Prüflauf ohne näher gemeldete Art." };
  }
}

// THE ROW UNDER THE TUBE reads branch → state (including whom it waits behind) → clock → kind. A
// lane whose title could be derived is named by it (laneDisplayName), and then its branch's four hex
// live in the tooltip only; every other ball still leads with its branch, as before. The renderer
// joins the parts into one ellipsised span, so a narrow board keeps the state.
// The clock is m:ss since
// `at`, computed on each repaint; a finished run says how long ago, a run with no known start says
// nothing. "/ ~p50" only where a distribution exists, and past its p90 the WORD, never a colour —
// G0.2 gives --amber to "unmeasured", and a long run is measured.
export function meterLine(b: MeterBall, now: number, german = false): string[] {
  if (!german) {
    const parts: string[] = [];
    if (b.kind !== b.name) parts.push(b.kind);
    if (b.at > 0) {
      const ms = now - b.at;
      if (b.station === "done") parts.push(`${mmss(ms)} ago`);
      else {
        const e = b.station !== "wait" && b.expect && b.expect.p50 >= 1000 ? b.expect : null;
        parts.push(`${mmss(ms)}${e ? ` / ~${mmss(e.p50)}${ms > e.p90 ? " länger als üblich" : ""}` : ""}`);
      }
    }
    if (b.what) parts.push(b.what);
    return parts;
  }
  const parts: string[] = b.slot !== null && b.title ? [] : [b.branch ? laneTail(b.branch) : "Branch unbekannt"];
  const waitingOn = b.station === "wait" && (b.what.startsWith("wartet ") || b.what.startsWith("nach Land"));
  if (waitingOn) parts.push(b.what.split(" · ")[0]!);
  if (b.at > 0) {
    const ms = now - b.at;
    if (b.station === "done") parts.push(`${b.tone === "ok" ? "bestanden" : b.tone === "red" ? "fehlgeschlagen" : "beendet"} vor ${mmss(ms)}`);
    else {
      const e = b.station !== "wait" && b.expect && b.expect.p50 >= 1000 ? b.expect : null;
      parts.push(`${waitingOn ? "seit" : b.station === "wait" ? "wartet seit" : "läuft seit"} ${mmss(ms)}${e ? ` / ~${mmss(e.p50)}${ms > e.p90 ? " länger als üblich" : ""}` : ""}`);
    }
  } else if (!waitingOn) parts.push(b.station === "wait" ? "wartet" : b.station === "done" ? "beendet" : "läuft");
  if (b.what && !waitingOn) parts.push(b.what);
  if (waitingOn && b.what.includes(" · ")) parts.push(b.what.split(" · ").slice(1).join(" · "));
  parts.push(meterKind(b.kind).label);
  return parts;
}

// how many runs sit at a station: the helper station's number is the same count as the devices'
// own `running` — a sharded audit counts each shard (MeterBall.runs)
export function meterRuns(balls: readonly MeterBall[], station: MeterStation): number {
  return balls.filter((b) => b.station === station).reduce((n, b) => n + (b.runs ?? 1), 0);
}

export function suiteMeter(inp: MeterInput): Meter {
  const balls: MeterBall[] = [];
  const here = inp.instance ?? "this machine";
  const nameOf = (slot: number | null, _label: string | null, _branch: string | null): string => {
    const s = slot === null ? undefined : inp.slots.find((x) => x.id === slot);
    return slot === null ? "Fleet" : s?.letter ? laneDisplayName(s.letter, s.title) : `Slot ${slot}`;
  };
  // whom a waiter stands behind, by its REFERENCE alone ("wartet hinter 0A", note cdf43028): the
  // waiter's own row already carries its name and title, and a second title inside the state cut both
  const refOf = (slot: number): string => inp.slots.find((x) => x.id === slot)?.letter ?? `Slot ${slot}`;
  const titleOf = (slot: number | null): string | null =>
    slot === null ? null : inp.slots.find((x) => x.id === slot)?.title ?? null;
  const branchOf = (slot: number | null, branch: string | null): string | null =>
    branch ?? (slot === null ? null : inp.slots.find((s) => s.id === slot)?.branch ?? null);

  // who holds the audit: a helper claim of kind "audit" puts the running audit on that helper. A
  // sharded audit is ONE claim per shard, and all of them are counted — one ball for the check,
  // saying how many parts are out and on which machines, clocked from the first claim.
  const auditClaims = inp.devices.flatMap((d) => (d.claims ?? []).filter((c) => c.kind === "audit")
    .map((claim) => ({ device: d.name, claim })));
  const auditHeld = auditClaims.length ? {
    device: [...new Set(auditClaims.map((c) => c.device))].join(", "),
    ref: auditClaims[0].claim.ref,
    parts: auditClaims.length > 1 ? `${auditClaims.length} parts` : "",
    at: Math.min(...auditClaims.map((c) => c.claim.claimedAt ?? Infinity)),
  } : null;
  const auditRuns = inp.audit?.running ?? null;

  for (const r of inp.gate?.reports ?? []) {
    // a slotless SERVER row is the tier-2 audit's own lock line; the audit is drawn from its live
    // view below, which knows the tree and the covered lands, so the thinner row steps aside
    if (r.slot === null && r.origin === "server" && auditRuns) continue;
    const station: MeterStation = r.phase === "waiting" ? "wait" : r.phase === "running" ? "run" : "done";
    const tone: MeterTone = r.phase === "done" ? "ok" : r.phase === "failed" ? "red" : "plain";
    // a SERVER row is fleet's own run: with a slot it is that lane's land, without one the audit.
    // Its wire label ("land gate", "post-land audit") is process vocabulary and stays off the row;
    // what it says instead is the suite the chain is in. A LANE row is the lane's own word about
    // its preview, and its label is the only stage there is.
    const server = r.origin === "server";
    const kind = !server ? "preview" : r.slot === null ? "post-land check" : "land check";
    const label = server ? r.stage ?? "" : r.suite;
    const what = r.phase === "failed" && r.exitCode !== null ? `${label} · exit ${r.exitCode}` : label;
    balls.push({ key: `gate:${r.origin ?? "lane"}:${r.slot ?? r.label ?? "-"}:${r.suite}`, station,
      slot: r.slot, name: nameOf(r.slot, r.label, r.branch ?? null), branch: branchOf(r.slot, r.branch ?? null), kind, what, where: here, tone, at: r.at,
      expect: server ? r.stats ?? null : null, title: titleOf(r.slot) });
  }

  for (const o of inp.offers) {
    const station: MeterStation = o.state === "open" ? "wait" : o.state === "claimed" ? "helper" : "done";
    const tone: MeterTone = o.state !== "reported" ? "plain"
      : o.result === "green" ? "ok" : o.result === "red" ? "red" : "unknown";
    // the PLACE of an offer is the device that took it; an offer nobody claimed is not running
    // anywhere yet, and saying "here" about it would be the one wrong answer
    balls.push({ key: `offer:${o.slot}:${o.branch}`, station, slot: o.slot,
      // owner words (G0.5, owner 2026-09-22): „[Zitat entfernt]“ leaves the visible text; „[Zitat entfernt]“ is the
      // owner's word for an audit — this name derived by MAIN from that mapping (Slot 13)
      name: nameOf(o.slot, null, o.branch), branch: o.branch, kind: "preview", what: o.state === "open" ? "offered" : "",
      where: o.state === "open" ? "unclaimed" : o.device ?? "helper", tone, at: o.at, expect: null, title: titleOf(o.slot) });
  }

  // GATE SCRIPTS ON A HELPER: a session handed ./e2e-clean-review.sh, ./e2e-security.sh or
  // ./e2e-claude-gate.sh to another machine (server.ts, the command jobs). The device's claim list
  // (server.ts#helperDevicesView) is the one place they are counted, and it is the same list whose
  // runs the device reports as `running` — so each claimed one is a ball at `helper`, or the
  // station says fewer runs than the machine is carrying (note 159df4c9: three drawn, five running).
  for (const d of inp.devices) for (const c of d.claims ?? []) {
    if (c.kind !== "command") continue;
    const slot = c.slot ?? null;
    balls.push({ key: `command:${d.name}:${c.ref}:${c.cmd ?? "?"}:${c.claimedAt ?? 0}`, station: "helper", slot,
      name: slot === null ? c.ref : nameOf(slot, null, c.ref), branch: c.ref, kind: "gate script",
      what: (c.cmd ?? "").replace(/^\.\//, ""), where: d.name, tone: "plain", at: c.claimedAt ?? 0, expect: null,
      title: titleOf(slot) });
  }

  if (auditRuns?.sharded) {
    // A SHARDED HELPER RUN (server.ts#postLandAuditLiveView) is the helpers' work from its first
    // claim to its row, also BETWEEN two claims, when no device holds a shard: drawing it as a run
    // "here" with this machine's p50 would be a Mac run that does not exist. The place is the
    // machines running a shard now, else the ones that ran one; `runs` is the running shards, the
    // same count the devices report (0 between claims — the ball stays, the station adds nothing).
    const sh = auditRuns.sharded;
    const names = (states: string[]) => [...new Set(sh.shards.filter((x) => states.includes(x.state) && x.device)
      .map((x) => x.device!))];
    const running = sh.shards.filter((x) => x.state === "running").length;
    const reported = sh.shards.filter((x) => x.state === "reported").length;
    const sha = (auditRuns.mainSha ?? "").slice(0, 8);
    const where = names(["running"]).join(", ") || auditHeld?.device || names(["reported", "closed"]).join(", ") || "helper";
    balls.push({ key: "audit:run", station: "helper", slot: null, name: "post-land check", branch: auditRuns.main,
      kind: "post-land check", what: `${auditRuns.main ?? "main"}${sha ? `@${sha}` : ""} · ${reported}/${sh.n} parts done`,
      where, tone: "plain", at: auditRuns.startedAt ?? 0, expect: null, runs: running });
  } else if (auditRuns) {
    const sha = (auditRuns.mainSha ?? "").slice(0, 8);
    const tree = `${auditRuns.main ?? "main"}${sha ? `@${sha}` : ""}`;
    // the local distribution (`stats`) is THIS machine's cost and says nothing about a helper's run
    // (server.ts#auditCounts), so a held audit draws its clock and no expectation
    balls.push({ key: "audit:run", station: auditHeld ? "helper" : "run", slot: null, name: "post-land check", branch: auditRuns.main,
      kind: "post-land check",
      what: auditRuns.phase === "starting" && !auditHeld ? "starting"
        : auditHeld?.parts ? `${tree} · ${auditHeld.parts}` : tree,
      where: auditHeld ? auditHeld.device : here, tone: "plain", at: auditRuns.startedAt ?? 0,
      expect: auditHeld ? null : inp.audit?.stats ?? null, ...(auditHeld ? { runs: auditClaims.length } : {}) });
  } else if (auditHeld) {
    balls.push({ key: "audit:run", station: "helper", slot: null, name: "post-land check", branch: auditHeld.ref, kind: "post-land check",
      what: auditHeld.parts || auditHeld.ref, where: auditHeld.device, tone: "plain",
      at: Number.isFinite(auditHeld.at) ? auditHeld.at : 0, expect: null, runs: auditClaims.length });
  }
  for (const w of inp.audit?.waiting ?? []) {
    const landed = inp.slots.find((s) => s.branch === w.branch);
    const tail = landed?.title ? "" : ` (${laneTail(w.branch)})`;
    balls.push({ key: `audit:wait:${w.branch}`, station: "wait", slot: null, name: "post-land check", branch: w.main,
      // the landed lane by its name and title while its slot still holds it; without a title the
      // four hex stay beside the name, as they always did
      kind: "post-land check", what: `nach Land von ${landed ? nameOf(landed.id, null, w.branch) : `Lane ${laneTail(w.branch)}`}${tail}`,
      where: here, tone: "plain", at: w.at, expect: null });
  }

  // THE TICKET LINE AT THE MUTEX. Every live ticket is one ball at `wait`, carrying the position
  // its own wrapper is printing while it sleeps. These are the runs NOBODY ELSE on this surface can
  // see: a hand-started ./e2e-isolated.sh takes a ticket and files no verify-intent, so without
  // this the board showed a 20-minute hold with an empty waiting station behind it. A ticket whose
  // process is gone is kept and SAID to be dead rather than hidden — the wrappers reap it on the
  // next contention, and until then it is part of what a reader is looking at.
  const queue = inp.gate?.queue ?? [];
  const inLine = queue.filter((t) => t.alive).length;
  const lk = inp.gate?.lock ?? null;
  const holderName = lk?.owner ? lk.owner.slot !== null ? nameOf(lk.owner.slot, null, lk.owner.branch)
    : lk.owner.branch === "main" ? "Fleet" : `Lauf ${lk.pid ?? "?"}`
    : balls.find((b) => b.station === "run")?.name ?? "unbekanntem Lauf";
  const holderSlot = lk?.owner ? lk.owner.slot : balls.find((b) => b.station === "run")?.slot ?? null;
  let ahead = holderSlot !== null ? refOf(holderSlot) : holderName;
  for (const t of queue) {
    const name = t.owner?.slot !== null && t.owner?.slot !== undefined ? nameOf(t.owner.slot, null, t.owner.branch)
      : t.owner?.branch === "main" ? "Fleet" : `Lauf ${t.pid}`;
    balls.push({ key: `queue:${t.n}.${t.pid}`, station: "wait", slot: t.owner?.slot ?? null, name,
      branch: t.owner?.branch ?? null,
      kind: "queued check run", expect: null, title: titleOf(t.owner?.slot ?? null),
      what: t.alive ? `${t.position === 1 && !lk ? "wartet auf Prüfsperre" : `wartet hinter ${ahead}`} · Platz ${t.position}/${inLine}`
        : `Ticket ${t.n} · Prozess weg`,
      where: here, tone: t.alive ? "plain" : "warn",
      at: t.sinceMs === null ? 0 : Date.now() - t.sinceMs });
    if (t.alive) ahead = t.owner?.slot !== null && t.owner?.slot !== undefined ? refOf(t.owner.slot) : name;
  }

  const lock: MeterLock = !inp.gate ? null : !lk ? "free"
    : (lk.state as MeterLock) ?? (lk.alive === null ? "parked" : lk.alive ? "held" : "stale");
  // the mutex is held but no row above says by whom: that holder is still a suite on this box, and
  // leaving the run station empty would read as "nothing is running", the one thing it is not
  const holderReported = balls.some((b) => b.station === "run" && (!lk?.owner
    || (lk.owner.slot !== null ? b.slot === lk.owner.slot : b.branch === lk.owner.branch)));
  if ((lock === "held" || lock === "overdue" || lock === "unknown") && !holderReported) {
    balls.push({ key: "lock:holder", station: "run", slot: lk?.owner?.slot ?? null,
      name: lk?.owner ? holderName : "Fleet", branch: lk?.owner?.branch ?? null,
      kind: "check run", expect: null, title: titleOf(lk?.owner?.slot ?? null),
      what: lk?.pid === null || lk?.pid === undefined ? "pid unreadable" : `pid ${lk.pid}`,
      where: here, tone: lock === "overdue" ? "warn" : "plain", at: lk?.acquiredAt ?? 0 });
  }
  return { balls, lock };
}
