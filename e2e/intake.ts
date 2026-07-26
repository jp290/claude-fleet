// The public intake dropbox and everything the share host may and may not serve.
import { BASE, H, check, get, post } from "./harness";
import type { Ctx } from "./ctx";

export async function run(ctx: Ctx): Promise<void> {
  // --- intake (Phase E). Public dropbox, own secret, pending-only ---
  const INTAKE = process.env.FLEET_INTAKE_SECRET ?? "";
  if (INTAKE) {
    const noSecret = await fetch(BASE + "/intake", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "x" }) });
    check("intake without secret is 401", noSecret.status === 401);
    const wrongSecret = await fetch(BASE + "/intake", { method: "POST", headers: { "content-type": "application/json", "x-intake-secret": "nope" }, body: JSON.stringify({ text: "x" }) });
    check("intake with wrong secret is 401", wrongSecret.status === 401);
    const ok = await fetch(BASE + "/intake", { method: "POST", headers: { "content-type": "application/json", "x-intake-secret": INTAKE }, body: JSON.stringify({ text: "CEO wants dark mode", from: "ceo@acme.co" }) });
    check("intake with secret accepts", ok.ok);
    const sessI = (await (await get("/api/sessions")).json()) as { tasks: { id: string; source: string; from?: string; status: string }[]; intake: boolean };
    // the poll carries digests only (server.ts TaskDigest) — join the text back over the id
    const itId = ((await (await get("/api/tasks")).json()) as { tasks: { id: string; text: string }[] })
      .tasks.find((t) => t.text === "CEO wants dark mode")?.id;
    const it = sessI.tasks.find((t) => t.id === itId);
    check("intake task lands as pending from intake source", !!it && it.status === "pending" && it.source === "intake" && it.from === "ceo@acme.co", JSON.stringify(it));
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
