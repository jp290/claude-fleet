// The guest ops hook (briefs/guest-ops-panel.md): a configured command with a CLOSED set of verbs,
// owner-only by position, and absent entirely when FLEET_GUEST_CMD is unset.
//
// Everything here runs against a STAND-IN hook this module writes itself, never the real
// guest-ctl.sh — what is under test is the boundary in server.ts (what reaches an argv, who gets
// through, what happens when the script misbehaves), not colima or Docker. The stub appends its
// argv to a file, so "the verb was never interpolated into a shell" and "an unknown verb never
// reached the script" are measurements rather than readings of the code.
import { chmodSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { BASE, H, ROOT, TOKEN, check, get, post, readText, restartSrv } from "./harness";

const TMP = process.env.TMPDIR ?? "/tmp";
const HOOK = `${TMP}/fleet-e2e-guesthook-${process.pid}.sh`;
const ARGV = `${TMP}/fleet-e2e-guestargv-${process.pid}`;
const PWNED = `${TMP}/fleet-e2e-guest-pwned-${process.pid}`;
const STDIN = `${TMP}/fleet-e2e-gueststdin-${process.pid}`;

const argvLines = (): string[] => {
  try { return readFileSync(ARGV, "utf8").split("\n").filter(Boolean); } catch { return []; }
};
const writeHook = (body: string): void => {
  writeFileSync(HOOK, body);
  chmodSync(HOOK, 0o700);
};

// answers `status` with JSON, records every verb, and exits 0 for anything else
const GOOD_HOOK = `#!/bin/sh
printf '%s\\n' "$*" >> ${ARGV}
case "$1" in
status) printf '{"guests":[{"slot":1,"vm":"running","container":"running","exposed":true,"expired":false,"until":123,"timer":true,"hostname":"guest.example.com","authFails1h":0,"authFails24h":2,"lastAuthFail":99},{"slot":2,"vm":"running","container":"absent","exposed":false,"expired":false,"until":null,"timer":false,"hostname":"guest2.example.com","authFails1h":null,"authFails24h":null,"lastAuthFail":null}]}' ;;
link)   printf '{"url":"https://guest.example.com","token":"the-guest-credential"}' ;;
claude-token) cat > ${STDIN}; echo "guest-ctl: recreated" ;;
fail)   echo "deliberate failure" >&2; exit 1 ;;
*)      echo "ok $1" ;;
esac
`;

export async function run(): Promise<void> {
  // --- (1) unconfigured: the feature does not exist. This suite's server runs without
  // FLEET_GUEST_CMD, so this is simply the default state. 404 and not 400 on purpose — an unset
  // hook must be indistinguishable from a Fleet that never had the feature at all. ---
  check("guest status 404s when FLEET_GUEST_CMD is unset", (await get("/api/guest")).status === 404);
  check("guest action 404s when FLEET_GUEST_CMD is unset", (await post("/api/guest/start", {})).status === 404);

  rmSync(ARGV, { force: true });
  writeHook(GOOD_HOOK);
  await restartSrv({ FLEET_GUEST_CMD: HOOK });

  // --- (2) configured: the hook's JSON is passed through, plus the `configured` marker ---
  {
    const r = await get("/api/guest");
    const j = (await r.json()) as { configured?: boolean; guests?: { slot: number; exposed: boolean; hostname: string; authFails24h: number | null; container: string }[] };
    const g1 = j.guests?.find((g) => g.slot === 1);
    const g2 = j.guests?.find((g) => g.slot === 2);
    check("guest status returns every configured slot", r.ok && j.guests?.length === 2);
    check("slot 1 carries its own facts", g1?.exposed === true && g1.authFails24h === 2 && g1.hostname === "guest.example.com");
    check("slot 2 carries its own, different facts",
      g2?.exposed === false && g2.hostname === "guest2.example.com" && g2.container === "absent");
    check("a guest that is not running reports null knocks, never zero",
      g2?.authFails24h === null, JSON.stringify(g2));
    check("guest status marks itself configured", j.configured === true);
    check("guest status ran the hook with exactly 'status'", argvLines().includes("status"));
  }

  // --- (2b) the invite: a route of its own, and the credential is NOT on the status payload.
  // That separation is the property worth a check — status is read on every card open and after
  // every action, so a token leaking into it would be a token in every log that captures one. ---
  {
    const st = await (await get("/api/guest")).text();
    check("the guest status payload carries NO credential", !st.includes("the-guest-credential"), st.slice(0, 120));
    const r = await get("/api/guest/link?slot=1");
    const j = (await r.json()) as { url?: string; token?: string };
    check("the invite route returns the address and the token",
      r.ok && j.url === "https://guest.example.com" && j.token === "the-guest-credential");
    check("the invite ran the hook's own 'link' verb for that slot", argvLines().includes("link 1"));
    check("the invite is not reachable without the owner token",
      (await fetch(`${BASE}/api/guest/link`)).status === 401);
    // `link` is a READ, so it must not be reachable as an action either
    check("link is not a POST verb", (await post("/api/guest/link", {})).status === 400);
  }

  // --- (3) the verb is a CLOSED SET. The failure guarded against is an unknown verb reaching the
  // script's argv, so the assertion is not "400" alone — it is "the hook was never spawned". ---
  {
    const before = argvLines().length;
    check("an unknown guest verb is refused", (await post("/api/guest/boom", {})).status === 400);
    // `fail` exists in the stub and would exit 1 — it is still refused, because the set that
    // decides is the server's, never the script's
    check("a verb the hook implements is still refused if the server does not list it",
      (await post("/api/guest/fail", {})).status === 400);
    check("no refused verb reached the hook", argvLines().length === before);

    rmSync(PWNED, { force: true });
    const inj = await fetch(`${BASE}/api/guest/start;touch%20${PWNED}`, { method: "POST", headers: H, body: "{}" });
    check("a guest verb carrying shell syntax is not routed", inj.status === 404 || inj.status === 400);
    check("the injected verb never reached the hook", !argvLines().some((l) => l.includes(";")));
    check("the injected command did not run", !(await Bun.file(PWNED).exists()));
  }

  // --- (4) the verbs that do exist, and the single operand any of them takes ---
  {
    const r = await post("/api/guest/cut", {});
    const j = (await r.json()) as { ok?: boolean; verb?: string; out?: string };
    check("cut runs and reports the hook's own output",
      r.ok && j.ok === true && j.verb === "cut" && (j.out ?? "").includes("ok cut"));
    check("cut reached the hook with its slot", argvLines().includes("cut 1"));
    check("an action names the slot it was asked for",
      (await post("/api/guest/cut", { slot: 2 })).ok && argvLines().includes("cut 2"));
    for (const [name, slot] of [["a string", "1; rm -rf /"], ["zero", 0], ["a fraction", 1.5], ["out of range", 99]] as const)
      check(`an action refuses ${name} for slot`, (await post("/api/guest/cut", { slot })).status === 400);
    check("no refused slot reached the hook",
      argvLines().filter((l) => l.startsWith("cut")).every((l) => l === "cut 1" || l === "cut 2"));
    check("start and stop are accepted verbs",
      (await post("/api/guest/start", {})).ok && (await post("/api/guest/stop", {})).ok);
    check("the invite refuses an out-of-range slot",
      (await get("/api/guest/link?slot=99")).status === 400);

    check("renew defaults to slot 1 and 7 days", (await post("/api/guest/renew", {})).ok && argvLines().includes("renew 1 7"));
    check("renew accepts a whole number of days", (await post("/api/guest/renew", { slot: 2, days: 3 })).ok && argvLines().includes("renew 2 3"));
    for (const [name, days] of [["a string", "3; rm -rf /"], ["a fraction", 1.5], ["zero", 0], ["over the cap", 31]] as const)
      check(`renew refuses ${name} for days`, (await post("/api/guest/renew", { days })).status === 400);
    check("no refused renew reached the hook",
      argvLines().filter((l) => l.startsWith("renew")).every((l) => l === "renew 1 7" || l === "renew 2 3"));
  }

  // --- (4b) GIVING a guest its Claude credential. This is the only route that carries a secret
  // INWARDS, so the checks are about where that secret goes: onto the hook's stdin, and nowhere
  // near an argv (world-readable in `ps` for the life of the call). ---
  {
    const TOK = "sk-ant-oat-e2e-not-a-real-credential-000111222333";
    rmSync(STDIN, { force: true });
    const r = await post("/api/guest/claude-token", { slot: 1, token: TOK });
    const j = (await r.json()) as { ok?: boolean; out?: string };
    check("a Claude token can be given to a guest", r.ok && j.ok === true);
    check("the credential arrived on the hook's STDIN",
      (await readText(STDIN)).trim() === TOK);
    check("the credential NEVER appeared in an argv",
      !argvLines().some((l) => l.includes("sk-ant-oat")), argvLines().slice(-3).join(" | "));
    check("the hook was called with the verb and the slot", argvLines().includes("claude-token 1"));
    check("the response does not echo the credential back", !JSON.stringify(j).includes(TOK));
    // shape-checked at the boundary: a typo must not recreate a container around a garbage value
    for (const [name, tok] of [["empty", ""], ["not a setup-token", "hunter2"],
                               ["an owner token by mistake", "sk-ant-api03-aaaaaaaaaaaaaaaaaaaa"],
                               ["a non-string", 42]] as const)
      check(`giving ${name} as a Claude token is refused`,
        (await post("/api/guest/claude-token", { slot: 1, token: tok })).status === 400);
    check("no refused token reached the hook",
      (await readText(STDIN)).trim() === TOK);
    check("the token route is owner-only",
      (await fetch(`${BASE}/api/guest/claude-token`, { method: "POST", body: "{}" })).status === 401);
    check("the token route refuses an out-of-range slot",
      (await post("/api/guest/claude-token", { slot: 99, token: TOK })).status === 400);
  }

  // --- (5) a failing hook is reported as a failure, never as a state ---
  {
    // `fail` is not an allowed verb, so the failure path is exercised through a hook whose
    // ALLOWED verb exits non-zero
    writeHook(`#!/bin/sh\necho "the hook is unhappy" >&2\nexit 1\n`);
    await restartSrv({ FLEET_GUEST_CMD: HOOK });
    const r = await post("/api/guest/cut", {});
    const j = (await r.json()) as { ok?: boolean; exit?: number; out?: string };
    check("a non-zero hook is a 502 and says so", r.status === 502 && j.ok === false && j.exit === 1);
    check("the hook's stderr is carried back to the owner", (j.out ?? "").includes("the hook is unhappy"));

    writeHook(`#!/bin/sh\nprintf 'not json at all'\n`);
    await restartSrv({ FLEET_GUEST_CMD: HOOK });
    const bad = await get("/api/guest");
    const bj = (await bad.json()) as { error?: string };
    check("unparseable hook output is an error, not a guessed state",
      bad.status === 502 && (bj.error ?? "").includes("not JSON"));

    // the likeliest way this feature is ever misconfigured: a path that is not there. It must read
    // as an operator error, not as a 500 and not as a guessed guest state.
    await restartSrv({ FLEET_GUEST_CMD: `${TMP}/fleet-e2e-guest-does-not-exist-${process.pid}` });
    const gone = await get("/api/guest");
    check("a FLEET_GUEST_CMD that cannot be spawned is a clean error", gone.status === 502);
    check("…and the route still exists rather than pretending to be unconfigured", gone.status !== 404);
  }

  // --- (6) credentials. Owner-only, and the two valid-but-wrong-scope tokens this machine mints
  // are both refused. The share-host 404 lives in fleet-e2e-security.ts, which owns that fixture. ---
  {
    writeHook(GOOD_HOOK);
    await restartSrv({ FLEET_GUEST_CMD: HOOK });
    check("guest status without a token is 401",
      (await fetch(`${BASE}/api/guest`, { headers: { "content-type": "application/json" } })).status === 401);
    check("the owner token reaches it", (await get("/api/guest")).ok);

    const state = (await Bun.file(`${ROOT}/fleet.json`).json()) as
      { stewardToken?: string; slots?: Record<string, { selfToken?: string }> };
    const selfTok = Object.values(state.slots ?? {}).map((s) => s.selfToken).find(Boolean);
    if (selfTok) {
      check("a lane's real self token cannot read the guest route",
        (await fetch(`${BASE}/api/guest`, { headers: { authorization: `Bearer ${selfTok}` } })).status === 401);
      check("a lane's real self token cannot act on the guest route",
        (await fetch(`${BASE}/api/guest/cut`, { method: "POST", headers: { "x-fleet-self-token": selfTok }, body: "{}" })).status === 401);
    }
    if (state.stewardToken)
      check("the steward token cannot reach the guest route",
        (await fetch(`${BASE}/api/guest`, { headers: { authorization: `Bearer ${state.stewardToken}` } })).status === 403);
  }

  // leave the server as this module found it — nothing downstream should inherit a hook
  rmSync(HOOK, { force: true });
  rmSync(ARGV, { force: true });
  rmSync(PWNED, { force: true });
  rmSync(STDIN, { force: true });
  await restartSrv({ FLEET_GUEST_CMD: "" });
  check("the guest feature is gone again once the hook is unset", (await get("/api/guest")).status === 404);
}
