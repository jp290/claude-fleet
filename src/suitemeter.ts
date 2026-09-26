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
export interface MeterDevice { name: string; claims?: { kind?: string; repo: string; ref: string; claimedAt?: number; expiresAt: number }[] }
export interface MeterSlot { id: number; label: string | null; branch: string | null; letter?: string | null }
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
    default: return { label: "Prüflauf", title: "Ein Prüflauf ohne näher gemeldete Art." };
  }
}

// THE ROW UNDER THE TUBE reads branch → state (including whom it waits behind) → clock → kind.
// The renderer joins them into one ellipsised span, so a narrow board keeps the branch and state.
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
  const parts: string[] = [b.branch ? laneTail(b.branch) : "Branch unbekannt"];
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

export function suiteMeter(inp: MeterInput): Meter {
  const balls: MeterBall[] = [];
  const here = inp.instance ?? "this machine";
  const nameOf = (slot: number | null, _label: string | null, _branch: string | null): string => {
    const s = slot === null ? undefined : inp.slots.find((x) => x.id === slot);
    return slot === null ? "Fleet" : s?.letter || `Slot ${slot}`;
  };
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
      expect: server ? r.stats ?? null : null });
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
      where: o.state === "open" ? "unclaimed" : o.device ?? "helper", tone, at: o.at, expect: null });
  }

  if (auditRuns) {
    const sha = (auditRuns.mainSha ?? "").slice(0, 8);
    const tree = `${auditRuns.main ?? "main"}${sha ? `@${sha}` : ""}`;
    // the local distribution (`stats`) is THIS machine's cost and says nothing about a helper's run
    // (server.ts#auditCounts), so a held audit draws its clock and no expectation
    balls.push({ key: "audit:run", station: auditHeld ? "helper" : "run", slot: null, name: "post-land check", branch: auditRuns.main,
      kind: "post-land check",
      what: auditRuns.phase === "starting" && !auditHeld ? "starting"
        : auditHeld?.parts ? `${tree} · ${auditHeld.parts}` : tree,
      where: auditHeld ? auditHeld.device : here, tone: "plain", at: auditRuns.startedAt ?? 0,
      expect: auditHeld ? null : inp.audit?.stats ?? null });
  } else if (auditHeld) {
    balls.push({ key: "audit:run", station: "helper", slot: null, name: "post-land check", branch: auditHeld.ref, kind: "post-land check",
      what: auditHeld.parts || auditHeld.ref, where: auditHeld.device, tone: "plain",
      at: Number.isFinite(auditHeld.at) ? auditHeld.at : 0, expect: null });
  }
  for (const w of inp.audit?.waiting ?? []) {
    const landed = inp.slots.find((s) => s.branch === w.branch);
    balls.push({ key: `audit:wait:${w.branch}`, station: "wait", slot: null, name: "post-land check", branch: w.main,
      kind: "post-land check", what: `nach Land von ${landed ? nameOf(landed.id, null, w.branch) : `Lane ${laneTail(w.branch)}`} (${laneTail(w.branch)})`,
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
  let ahead = holderName;
  for (const t of queue) {
    const name = t.owner?.slot !== null && t.owner?.slot !== undefined ? nameOf(t.owner.slot, null, t.owner.branch)
      : t.owner?.branch === "main" ? "Fleet" : `Lauf ${t.pid}`;
    balls.push({ key: `queue:${t.n}.${t.pid}`, station: "wait", slot: t.owner?.slot ?? null, name,
      branch: t.owner?.branch ?? null,
      kind: "queued check run", expect: null,
      what: t.alive ? `${t.position === 1 && !lk ? "wartet auf Prüfsperre" : `wartet hinter ${ahead}`} · Platz ${t.position}/${inLine}`
        : `Ticket ${t.n} · Prozess weg`,
      where: here, tone: t.alive ? "plain" : "warn",
      at: t.sinceMs === null ? 0 : Date.now() - t.sinceMs });
    if (t.alive) ahead = name;
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
      kind: "check run", expect: null,
      what: lk?.pid === null || lk?.pid === undefined ? "pid unreadable" : `pid ${lk.pid}`,
      where: here, tone: lock === "overdue" ? "warn" : "plain", at: lk?.acquiredAt ?? 0 });
  }
  return { balls, lock };
}
