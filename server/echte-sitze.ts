// THE DOOR OF A TEST INSTANCE WITH REAL SEATS (testinstanz.sh up --real-seats; owner 22.10.: „[Zitat entfernt]“).
// testinstanz-claude.sh registers every real claude of this machine as <registry>/<pid>.seat (pid, birth, where) and
// refuses a third in its pane. A lead that opens through a door must hear that at the door, not find it later in a pane:
// so the open refuses with the same sentence while the machine already holds `cap` live seats. The pane's lock stays the
// wall for two opens racing past this check.
import { existsSync } from "node:fs";

export interface RealSeatGate { registry: string; cap: number; armed: string; waitMs: number }

// FLEET_REAL_SEAT_REGISTRY, FLEET_REAL_SEAT_CAP and FLEET_REAL_SEAT_ARMED, all three or none; FLEET_REAL_SEAT_WAIT_MS only
// shortens the wait below (a route test), never needed on an instance
export function realSeatGateFrom(env: Record<string, string | undefined>): RealSeatGate | null {
  const registry = env.FLEET_REAL_SEAT_REGISTRY, armed = env.FLEET_REAL_SEAT_ARMED, cap = Number(env.FLEET_REAL_SEAT_CAP);
  if (!registry || !armed || !Number.isInteger(cap) || cap < 1) return null;
  const wait = Number(env.FLEET_REAL_SEAT_WAIT_MS);
  return { registry, cap, armed, waitMs: Number.isInteger(wait) && wait >= 0 ? wait : REAL_SEAT_WAIT_MS };
}

// the start time ps reports for a pid, as the wrapper writes it; "" for a pid that is gone
export function psLstart(pid: number): string {
  const p = Bun.spawnSync(["ps", "-p", String(pid), "-o", "lstart="], { env: { ...process.env, LC_ALL: "C" }, stdout: "pipe", stderr: "ignore" });
  return p.exitCode === 0 ? p.stdout.toString().trim() : "";
}

// a registered seat counts only while its pid still has the birth it registered with — a recycled pid is no seat
export async function liveRealSeats(registry: string, lstart: (pid: number) => string = psLstart): Promise<string[]> {
  const where: string[] = [];
  // no registry yet: no real seat has ever started on this machine
  if (!existsSync(registry)) return where;
  for await (const name of new Bun.Glob("*.seat").scan({ cwd: registry, onlyFiles: true })) {
    const text = await Bun.file(`${registry}/${name}`).text().catch(() => "");
    const field = (k: string): string => new RegExp(`^${k}=(.*)$`, "m").exec(text)?.[1]?.trim() ?? "";
    const pid = Number(field("pid")), birth = field("birth");
    if (Number.isInteger(pid) && pid > 1 && birth && lstart(pid) === birth) where.push(field("where") || `pid ${pid}`);
  }
  return where.sort();
}

// A SEAT THAT IS ENDING STILL COUNTS until its claude has exited — a few seconds after its tmux session is gone (measured
// 22.10.). A succession ends the predecessor and opens the successor at once, so at the cap it would lose the seat (the
// acceptance measured POST /api/self/succeed → 500, slot empty). The door therefore waits up to this long for a place
// before it refuses; a real third seat waits the same, and then hears why.
export const REAL_SEAT_WAIT_MS = 15_000;
const REAL_SEAT_POLL_MS = 500;

// null = the open may go on; else the sentence the door answers. Before `up` armed the instance every claude is a stand-in,
// so the fixtures are never refused.
export async function realSeatRefusal(gate: RealSeatGate, lstart: (pid: number) => string = psLstart): Promise<string | null> {
  if (!(await Bun.file(gate.armed).exists())) return null;
  const until = Date.now() + gate.waitMs;
  let live = await liveRealSeats(gate.registry, lstart);
  while (live.length >= gate.cap && Date.now() < until) {
    await Bun.sleep(REAL_SEAT_POLL_MS);
    live = await liveRealSeats(gate.registry, lstart);
  }
  if (live.length < gate.cap) return null;
  return `Testinstanz: abgelehnt — auf diesem Rechner laufen schon ${live.length} echte Claude-Sitze, höchstens ${gate.cap} `
    + `(Owner 22.10.) · ${live.join(" · ")}. Erst einen beenden (seine Session schließen oder ./testinstanz.sh down), dann neu öffnen.`;
}
