// The public intake dropbox and everything the share host may and may not serve.
import { BASE, H, check, get, post } from "./harness";
import type { Ctx } from "./ctx";

export async function run(ctx: Ctx): Promise<void> {
  // --- intake (Phase E). Public dropbox, own secret, pending-only ---
  const INTAKE = process.env.FLEET_INTAKE_SECRET ?? "";
  if (INTAKE) {
    const noSecret = await fetch(BASE + "/intake", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "x" }) });
    check("intake without secret is 401", noSecret.status === 401);
    // a wrong secret is a password guess, and this endpoint answers on the PUBLIC tunnel (it is
    // dispatched before the share-host gate). So it owes the same three things every other
    // credential surface here already does: cost, a trace, and a lockout. It had none — the hourly
    // cap counted accepted submissions only (d8efc50f).
    const t0 = Date.now();
    const wrongSecret = await fetch(BASE + "/intake", { method: "POST", headers: { "content-type": "application/json", "x-intake-secret": "nope" }, body: JSON.stringify({ text: "x" }) });
    const wrongMs = Date.now() - t0;
    check("intake with wrong secret is 401", wrongSecret.status === 401);
    check("intake: a wrong secret costs wall-clock (throttled like every other credential check)",
      wrongMs >= 350, `${wrongMs}ms`);
    // length-mismatch and same-length paths must BOTH be throttled — an early length return would
    // make the delay itself a length oracle
    const t1 = Date.now();
    const wrongSameLen = await fetch(BASE + "/intake", { method: "POST",
      headers: { "content-type": "application/json", "x-intake-secret": "x".repeat(INTAKE.length) }, body: JSON.stringify({ text: "x" }) });
    const sameLenMs = Date.now() - t1;
    check("intake: a same-length wrong secret is throttled too (no length oracle)",
      wrongSameLen.status === 401 && sameLenMs >= 350, `${sameLenMs}ms status=${wrongSameLen.status}`);
    const failAudit = (await (await get("/api/audit?limit=50")).json()) as { events: { event: string; detail?: string }[] };
    check("intake: a failed guess leaves an audit trace, and never the attempted secret",
      failAudit.events.some((e) => e.event === "intake_auth_fail")
      && !JSON.stringify(failAudit.events).includes("nope"),
      JSON.stringify(failAudit.events.filter((e) => e.event.startsWith("intake_")).slice(0, 3)));
    // THE SENDER LABEL IS ACCEPTED AND DROPPED. `from` was persisted for display only and read by
    // nothing that decides, which made it a channel for attacker prose from the one public write
    // door onto the owner's queue board. The door still takes the field (an unchanged Email Worker
    // must not start failing), so the assertion is that it does not SURVIVE: not on the row, not on
    // the poll digest, not anywhere in either payload — while provenance and status are untouched.
    const SENDER = "ceo-sender-label@acme.co";
    const ok = await fetch(BASE + "/intake", { method: "POST", headers: { "content-type": "application/json", "x-intake-secret": INTAKE }, body: JSON.stringify({ text: "CEO wants dark mode", from: SENDER }) });
    check("intake with secret accepts", ok.ok);
    const sessI = (await (await get("/api/sessions")).json()) as { tasks: { id: string; source: string; from?: string; status: string }[]; intake: boolean };
    // the poll carries digests only (server.ts TaskDigest) — join the text back over the id
    const tasksBody = (await (await get("/api/tasks")).json()) as { tasks: { id: string; text: string; from?: string }[] };
    const itFull = tasksBody.tasks.find((t) => t.text === "CEO wants dark mode");
    const it = sessI.tasks.find((t) => t.id === itFull?.id);
    check("intake task lands as pending from intake source", !!it && it.status === "pending" && it.source === "intake", JSON.stringify(it));
    check("intake: the unknown sender label is not mirrored back on the row",
      !!itFull && itFull.from === undefined && !JSON.stringify(itFull).includes(SENDER),
      JSON.stringify(itFull));
    check("intake: nor on the 2 s poll digest, which is what the board renders",
      !!it && it.from === undefined && !JSON.stringify(sessI.tasks).includes(SENDER),
      JSON.stringify(it));
    check("sessions reports intake enabled", sessI.intake === true);
    check("intake rejects empty text", (await fetch(BASE + "/intake", { method: "POST", headers: { "content-type": "application/json", "x-intake-secret": INTAKE }, body: JSON.stringify({ text: "   " }) })).status === 400);
  }

  const SHARE_HOST = process.env.FLEET_SHARE_HOSTS ?? "";
  if (SHARE_HOST) {
    // intake is the one write path reachable on the public share host
    if (INTAKE) {
      const pubIntake = await fetch(BASE + "/intake", { method: "POST",
        headers: { host: SHARE_HOST, "content-type": "application/json", "x-intake-secret": INTAKE },
        body: JSON.stringify({ text: "via share host", from: "x" }) });
      check("intake reachable on the share host", pubIntake.ok);
      check("share host still blocks task API (owner-only)", (await fetch(BASE + "/api/tasks", { method: "POST",
        headers: { host: SHARE_HOST, ...H, "content-type": "application/json" }, body: JSON.stringify({ text: "y" }) })).status === 404);
    }
    const landing = await fetch(BASE + "/", { headers: { host: SHARE_HOST } });
    const landingBody = await landing.text();
    check("share host hides the dashboard", landing.status === 200 && landingBody.includes("cowork — live sessions") && !landingBody.includes("app.js"),
      `status ${landing.status}`);
    check("share host hides the manifest", (await fetch(BASE + "/manifest.webmanifest", { headers: { host: SHARE_HOST } })).status === 404);
    const sPub = await fetch(BASE + `/s/${ctx.shViewId}`, { headers: { host: SHARE_HOST } });
    check("share host serves the share page", sPub.status === 200 && (await sPub.text()).includes("share.js"));
    check("share host blocks owner API even with token", (await fetch(BASE + "/api/sessions", { headers: { host: SHARE_HOST, ...H } })).status === 404);
    check("share host blocks the audit read endpoint even with token", (await fetch(BASE + "/api/audit", { headers: { host: SHARE_HOST, ...H } })).status === 404);
    // --- regression: the share-only allowlist regex must not be widenable via path tricks.
    // A plain fetch() normalizes "../" client-side before the request is even sent — but the
    // server parses req.url through the same WHATWG URL rules (verified directly: dot-segments
    // collapse identically whether resolved by the client or the server), so this still guards
    // the real end-to-end invariant. The other two send bytes fetch does NOT pre-normalize,
    // reaching the server's own matching logic unmodified. ---
    check("share host: dot-segment traversal to owner API blocked", (await fetch(BASE + `/s/${ctx.shViewId}/../../api/sessions`,
      { headers: { host: SHARE_HOST, ...H } })).status === 404);
    check("share host: encoded-slash path does not decode into a bypass", (await fetch(BASE + `/s/${ctx.shViewId}%2f..%2fapi%2fsessions`,
      { headers: { host: SHARE_HOST, ...H } })).status === 404);
    // an all-digit id (≈2.3% of runs) has no uppercase variant — the premise doesn't exist, pass vacuously
    check("share host: uppercase share id does not bypass the lowercase-only regex", !/[a-f]/.test(ctx.shViewId) || (await fetch(BASE + `/s/${ctx.shViewId.toUpperCase()}`,
      { headers: { host: SHARE_HOST } })).status === 404);
  }
  const unshare = await post("/api/slots/2/unshare", {});
  check("unshare accepted", unshare.ok);
  check("revoked share is gone", (await fetch(BASE + `/s/${ctx.shViewId}/info`, { headers: { cookie: ctx.shCookie } })).status === 404);
  const shPersistRes = await post("/api/slots/2/share", { mode: "view", password: "persistpass1" });
  const shPersist = (await shPersistRes.json()) as { id: string };
  check("re-share after revoke", shPersistRes.ok && !!shPersist.id);
  ctx.shPersistId = shPersist.id;
}
