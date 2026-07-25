// The scoped self-scheduling credential: FLEET_SELF_TOKEN / FLEET_SELF_SLOT in a lane pane's
// spawn env, and what /api/self/autos will and will not accept it for.
import { BASE, REPO, TOKEN, check, paneEnv, post } from "./harness";
import type { Ctx } from "./ctx";

export async function run(ctx: Ctx): Promise<void> {
  // --- Part C: scoped self-scheduling token (FLEET_SELF_TOKEN / FLEET_SELF_SLOT) ---
  const lnTok = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  // Both probes read the pane through paneEnv (harness.ts): a unique marker per probe, matched
  // line-anchored, with the send-keys retried until the marked OUTPUT line renders. That is what
  // makes them deterministic — a fixed sleep raced the shell's readiness AND the render, and a
  // bare poll could still settle on an earlier probe's line. A null answer means the pane never
  // replied at all (a harness failure), which is not the same as an empty variable.
  const laneTok = await paneEnv(`s${lnTok.slot}`, "FLEET_SELF_TOKEN");
  const laneSlot = await paneEnv(`s${lnTok.slot}`, "FLEET_SELF_SLOT");
  check("FLEET_SELF_TOKEN + FLEET_SELF_SLOT present in a lane slot's spawn env",
    /^[0-9a-f]{32}$/.test(laneTok ?? "") && Number(laneSlot) === lnTok.slot, `tok=[${laneTok}] slot=[${laneSlot}]`);
  const selfTok = laneTok ?? "";
  // the NEGATIVE half: a plain (non-lane) slot's shell must report the variable as unset. An
  // empty string is the assertion; null (pane never answered) fails, so a silent probe can never
  // be mistaken for "no token".
  const plainTok = await paneEnv("s2", "FLEET_SELF_TOKEN");
  check("FLEET_SELF_TOKEN absent for a non-lane slot", plainTok === "", `[${plainTok}]`);

  const selfAuto = (opts: { token?: string; body?: unknown }) => fetch(BASE + "/api/self/autos", {
    method: "POST",
    headers: { "content-type": "application/json", ...(opts.token !== undefined ? { "x-fleet-self-token": opts.token } : {}) },
    body: JSON.stringify(opts.body ?? { text: "x", inSec: 60 }),
  });
  const okRes = await selfAuto({ token: selfTok, body: { text: "self-scheduled check-in", inSec: 3600, slot: 2 } });
  const okJ = (await okRes.json()) as { ok?: boolean; auto?: { id: string; slot: number } };
  check("POST /api/self/autos succeeds with a valid selfToken", okRes.ok && !!okJ.auto, JSON.stringify(okJ));
  check("a spoofed `slot` field in the body is ignored — the auto lands on the token's OWN slot",
    okJ.auto?.slot === lnTok.slot, JSON.stringify(okJ.auto));
  const ownerOnSelf = await selfAuto({ token: TOKEN });
  check("the owner token does not substitute for a selfToken on this route", ownerOnSelf.status === 401);
  const wrongSelf = await selfAuto({ token: "0".repeat(32) });
  check("an unknown selfToken is rejected", wrongSelf.status === 401);
  const noSelf = await selfAuto({});
  check("a missing selfToken header is rejected", noSelf.status === 401);
  if (okJ.auto) check("delete self-scheduled auto (cleanup)", (await post(`/api/autos/${okJ.auto.id}/delete`, {})).ok);
  const selfPerp = await selfAuto({ token: selfTok, body: { text: "self immortal", inSec: 5, everySec: 10, perpetual: true } });
  check("a self-token lane cannot mint a perpetual auto (owner-only, 403)", selfPerp.status === 403, String(selfPerp.status));
  // KEEP this lane alive across the server restart (below) to prove its selfToken persists —
  // the restart section (guards fix A) uses this token, then tears the lane down.
  ctx.restartSelfTok = selfTok;
  ctx.restartSelfSlot = lnTok.slot;
}
