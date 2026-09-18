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
  what: string;            // which suite / where, one short phrase
  tone: MeterTone;
  at: number;              // when this row last changed state (server clock)
}
export type MeterLock = "free" | "held" | "overdue" | "parked" | "stale" | "unknown" | null;
export interface Meter { balls: MeterBall[]; lock: MeterLock }

// the wire shapes, restated structurally: client.ts owns GateInfo and HelperDeviceInfo, and this
// module takes only the fields it reads so the e2e caller can hand it plain objects.
export interface MeterGate {
  lock: { pid: number | null; alive: boolean | null; state?: string } | null;
  reports: { slot: number | null; label: string | null; phase: string; suite: string;
    exitCode: number | null; at: number; origin?: string; branch?: string | null }[];
}
export interface MeterDevice { name: string; claims?: { kind?: string; repo: string; ref: string; expiresAt: number }[] }
export interface MeterSlot { id: number; label: string | null; branch: string | null }
export interface MeterInput {
  gate: MeterGate | null;
  audit: PostLandAuditLiveInfo | null;
  offers: SuiteOfferRow[];
  devices: MeterDevice[];
  slots: MeterSlot[];
}

// A fleet branch is `fleet/<yymmddhhmmss>-<4 hex>`; the four hex are what tells two lanes apart, so
// an unlabelled lane is named by them rather than by a prefix every lane shares.
export function laneTail(branch: string): string {
  const m = /-([0-9a-f]{4})$/.exec(branch);
  return m ? m[1] : branch.replace(/^fleet\//, "");
}

export function suiteMeter(inp: MeterInput): Meter {
  const balls: MeterBall[] = [];
  const nameOf = (slot: number | null, label: string | null, branch: string | null): string => {
    const s = slot === null ? undefined : inp.slots.find((x) => x.id === slot);
    const lbl = label ?? s?.label ?? null;
    const br = branch ?? s?.branch ?? null;
    const who = lbl ?? (br ? laneTail(br) : null);
    return slot === null ? (who ?? "fleet") : who ? `${slot} · ${who}` : `slot ${slot}`;
  };

  // who holds the audit: a helper claim of kind "audit" puts the running audit on that helper
  const auditHeld = inp.devices.flatMap((d) => (d.claims ?? []).filter((c) => c.kind === "audit")
    .map((claim) => ({ device: d.name, claim })))[0] ?? null;
  const auditRuns = inp.audit?.running ?? null;

  for (const r of inp.gate?.reports ?? []) {
    // a slotless SERVER row is the tier-2 audit's own lock line; the audit is drawn from its live
    // view below, which knows the tree and the covered lands, so the thinner row steps aside
    if (r.slot === null && r.origin === "server" && auditRuns) continue;
    const station: MeterStation = r.phase === "waiting" ? "wait" : r.phase === "running" ? "run" : "done";
    const tone: MeterTone = r.phase === "done" ? "ok" : r.phase === "failed" ? "red" : "plain";
    const what = r.phase === "failed" && r.exitCode !== null ? `${r.suite} · exit ${r.exitCode}` : r.suite;
    balls.push({ key: `gate:${r.origin ?? "lane"}:${r.slot ?? r.label ?? "-"}:${r.suite}`, station,
      slot: r.slot, name: nameOf(r.slot, r.label, r.branch ?? null), what, tone, at: r.at });
  }

  for (const o of inp.offers) {
    const station: MeterStation = o.state === "open" ? "wait" : o.state === "claimed" ? "helper" : "done";
    const tone: MeterTone = o.state !== "reported" ? "plain"
      : o.result === "green" ? "ok" : o.result === "red" ? "red" : "unknown";
    const what = o.state === "open" ? "suite offer · no helper yet" : `suite offer · ${o.device ?? "helper"}`;
    balls.push({ key: `offer:${o.slot}:${o.branch}`, station, slot: o.slot,
      name: nameOf(o.slot, null, o.branch), what, tone, at: o.at });
  }

  if (auditRuns) {
    const sha = (auditRuns.mainSha ?? "").slice(0, 8);
    const tree = `${auditRuns.main ?? "main"}${sha ? `@${sha}` : ""}`;
    balls.push({ key: "audit:run", station: auditHeld ? "helper" : "run", slot: null, name: "post-land audit",
      what: auditHeld ? `${tree} · ${auditHeld.device}` : auditRuns.phase === "starting" ? "starting" : tree,
      tone: "plain", at: auditRuns.startedAt ?? 0 });
  } else if (auditHeld) {
    balls.push({ key: "audit:run", station: "helper", slot: null, name: "post-land audit",
      what: `${auditHeld.claim.ref} · ${auditHeld.device}`, tone: "plain", at: 0 });
  }
  for (const w of inp.audit?.waiting ?? []) {
    balls.push({ key: `audit:wait:${w.branch}`, station: "wait", slot: null, name: "post-land audit",
      what: `after ${laneTail(w.branch)}`, tone: "plain", at: w.at });
  }

  const lk = inp.gate?.lock ?? null;
  const lock: MeterLock = !inp.gate ? null : !lk ? "free"
    : (lk.state as MeterLock) ?? (lk.alive === null ? "parked" : lk.alive ? "held" : "stale");
  // the mutex is held but no row above says by whom: that holder is still a suite on this box, and
  // leaving the run station empty would read as "nothing is running", the one thing it is not
  if ((lock === "held" || lock === "overdue" || lock === "unknown") && !balls.some((b) => b.station === "run")) {
    balls.push({ key: "lock:holder", station: "run", slot: null, name: "unnamed holder",
      what: lk?.pid === null || lk?.pid === undefined ? "pid unreadable" : `pid ${lk.pid}`,
      tone: lock === "overdue" ? "warn" : "plain", at: 0 });
  }
  return { balls, lock };
}
