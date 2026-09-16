// The simulator-reap DECISION TABLE — the half of e2e/host-hygiene.ts that needs no server.
//
// It lives in its own module for one reason: it must be runnable WITHOUT e2e/harness.ts. The
// harness refuses to import outside a wrapper (no fleet.json, live-port refusal), and the cheapest
// honest proof that these checks can fail is to mutate simulator-hygiene.ts and run this table
// alone — seconds, no server, no suite mutex. See §MUTATION at the foot of e2e/host-hygiene.ts for
// the exact edit and what it turns red.
//
// So the recorder is a PARAMETER, not an import: fleet-e2e.ts passes the harness's own `check` (so
// every row lands in the results and the trail like any other), and the mutation proof passes a
// two-line counter of its own.
import {
  decideSimulatorReap, simReapArming, SIM_IDLE_MS_DEFAULT,
  type SimLease, type SimReapDecision, type SimReapInput, type SimulatorProbe,
} from "../simulator-hygiene";

// exactly e2e/harness.ts#check's shape — the harness passes its own, the mutation proof a counter
export type CheckFn = (name: string, ok: boolean, detail?: string) => void;

const NOW = 1_700_000_000_000;
const GRACE = 1_800_000;
// the shape the decision is asked about: a simulator that is up, nothing building, no lease
const IDLE: SimulatorProbe = { booted: 1, appRunning: true, toolRunning: false, leases: [] };
const decide = (over: Partial<SimReapInput>): SimReapDecision =>
  decideSimulatorReap({ ...IDLE, firstSeenAt: NOW - GRACE, now: NOW, graceMs: GRACE, ...over });

const lease = (state: SimLease["state"], pid: number | null = null): SimLease =>
  ({ path: "/tmp/private-repo-p-simulator.lock", state, pid });

export function decisionChecks(check: CheckFn): void {
  // ===== (a) THE DECISION TABLE: `reap` is reachable only through every clause =====
  {
    const d = decide({});
    check("host-hygiene §a an idle simulator past its grace, with no lease and no tool, is reaped",
      d.action === "reap", JSON.stringify(d));
  }
  {
    // the MEASURED case (2026-09-15): Simulator.app up for 13 days with zero booted devices. An
    // app-only reap must be reachable, or the one fact that started this work decides nothing.
    const d = decide({ booted: 0 });
    check("host-hygiene §a Simulator.app alone — zero booted devices — is still reaped",
      d.action === "reap", JSON.stringify(d));
  }
  {
    const d = decide({ booted: 3, appRunning: false });
    check("host-hygiene §a booted devices with no app window are reaped",
      d.action === "reap", JSON.stringify(d));
  }
  {
    // the boundary is >=, stated in both directions so an off-by-one cannot pass either half
    const at = decide({ firstSeenAt: NOW - GRACE });
    const under = decide({ firstSeenAt: NOW - GRACE + 1 });
    check("host-hygiene §a the grace boundary is inclusive: exactly graceMs reaps, one ms under waits",
      at.action === "reap" && under.action === "wait", `at=${at.action} under=${under.action}`);
  }
  {
    // a lock directory whose owner pid is DEAD is not somebody's lease — it is litter private-repo-p
    // left behind, and it must not immunise a simulator forever
    const d = decide({ leases: [lease("stale", 999_999)] });
    check("host-hygiene §a a stale lease (readable pid, dead process) does not hold the simulator",
      d.action === "reap", JSON.stringify(d));
  }
  {
    const d = decide({ graceMs: SIM_IDLE_MS_DEFAULT, firstSeenAt: NOW - SIM_IDLE_MS_DEFAULT });
    check("host-hygiene §a the shipped default grace is 30 min and reaps at it",
      SIM_IDLE_MS_DEFAULT === 1_800_000 && d.action === "reap", `${SIM_IDLE_MS_DEFAULT} ${d.action}`);
  }

  // ===== (b) THE REFUSALS, each naming ITS OWN fact =====
  const refusals: { name: string; d: SimReapDecision; want: SimReapDecision["action"]; says: RegExp }[] = [
    {
      name: "a lease held by a live pid",
      d: decide({ leases: [lease("held", process.pid)] }),
      want: "none", says: /held by live pid/,
    },
    {
      name: "a lease directory with no readable pid — UNKNOWN, never reaped",
      d: decide({ leases: [lease("unknown")] }),
      want: "none", says: /no readable owner pid/,
    },
    {
      name: "a running xcodebuild/simctl/xctest",
      d: decide({ toolRunning: true }),
      want: "none", says: /tool is running/,
    },
    {
      name: "the grace has not elapsed",
      d: decide({ firstSeenAt: NOW - 1000 }),
      want: "wait", says: /of the 1800000 ms grace/,
    },
    {
      name: "the probe failed — an unknown host",
      d: decide({ booted: null }),
      want: "none", says: /probe failed/,
    },
    {
      name: "nothing is running at all",
      d: decide({ booted: 0, appRunning: false }),
      want: "none", says: /nothing to reap/,
    },
    {
      name: "the idle run has only just been observed",
      d: decide({ firstSeenAt: null }),
      want: "wait", says: /grace clock starts now/,
    },
  ];
  for (const r of refusals)
    check(`host-hygiene §b refused, with its own reason: ${r.name}`,
      r.d.action === r.want && r.says.test(r.d.reason), `${r.d.action}: ${r.d.reason}`);
  {
    // "each with its own reason" as a property, not as seven separate hopes: a refactor that
    // collapsed two clauses into one shared sentence would pass every row above and fail here
    const reasons = refusals.map((r) => r.d.reason);
    check("host-hygiene §b no two refusals share a reason",
      new Set(reasons).size === reasons.length, `${new Set(reasons).size} distinct of ${reasons.length}`);
  }
  {
    // ORDER: a held lease outranks everything below it. Without this, "lease respected" could be
    // true only because some other clause happened to refuse first.
    const d = decide({ leases: [lease("held", process.pid)], firstSeenAt: NOW - 10 * GRACE });
    check("host-hygiene §b a held lease outranks an arbitrarily long idle run",
      d.action === "none" && /held by live pid/.test(d.reason), JSON.stringify(d));
  }
  {
    // …and an unknown lease outranks a held one: the most ignorant fact wins, which is the whole
    // direction of this table
    const d = decide({ leases: [lease("held", process.pid), lease("unknown")] });
    check("host-hygiene §b an unknown lease outranks a held one — the least-known fact decides",
      d.action === "none" && /no readable owner pid/.test(d.reason), JSON.stringify(d));
  }

  // ===== the arming flag: OFF by default, OFF on a typo and SAYING so, OFF off darwin =====
  {
    const cases: { raw: string | undefined; platform: string; on: boolean; says: RegExp }[] = [
      { raw: undefined, platform: "darwin", on: false, says: /FLEET_SIM_REAP unset/ },
      { raw: "", platform: "darwin", on: false, says: /FLEET_SIM_REAP unset/ },
      { raw: "0", platform: "darwin", on: false, says: /off/ },
      { raw: "off", platform: "darwin", on: false, says: /off/ },
      { raw: "maybe", platform: "darwin", on: false, says: /is not a recognised value/ },
      { raw: "1", platform: "linux", on: false, says: /not darwin/ },
      { raw: "1", platform: "darwin", on: true, says: /armed/ },
      { raw: "yes", platform: "darwin", on: true, says: /armed/ },
    ];
    const wrong = cases.filter((c) => {
      const a = simReapArming(c.raw, c.platform);
      return a.on !== c.on || !c.says.test(a.log);
    });
    check("host-hygiene §b the arming flag: default OFF, an unrecognised value OFF and said out loud, non-darwin OFF",
      wrong.length === 0, `wrong=[${wrong.map((c) => `${String(c.raw)}/${c.platform}`).join(", ")}]`);
  }
}
