// Kindprozess der Routen-Tests (server/branches-routes.test.ts): ein Leben des Servers, ohne Start.
// Zustand aus FLEET_STATE_DIR/fleet.json laden, die Boot-Umschlüsselung der Branch-Datensätze, dann die
// Schritte aus argv[2] über den Route-Handler; die Antworten gehen als JSON nach stdout. Ein eigener
// Prozess je Leben, weil bun test alle Testdateien in einem Prozess fährt: ein Import von server.ts
// hier legte FLEET_STATE_DIR für server/load.test.ts mit fest.
import { existsSync, rmSync } from "node:fs";
import { open } from "node:fs/promises";
import { join } from "node:path";

// `self`: der Self-Token einer Session, als x-fleet-self-token neben (oder mit token: null statt) dem Owner-Bearer
interface Step { method: "GET" | "POST"; path: string; body?: unknown; token?: string | null; self?: string }
// `until`: warten, bis die Datei da ist, höchstens `ms` — was der Server nach einer Antwort im Hintergrund
// anstößt (der Code-Graph nach einem Land), endet sonst mit diesem Leben; Antwort 200, oder 408 nach `ms`
interface Until { until: string; ms: number }
// `rohr`: die Datei im Zustandsordner wird eine Röhre, aus der erst nach `ms` gelesen wird. Ein Schreiben dorthin hält die eine Schreibkette
// von persist.ts an (alle Ereignisprotokolle teilen sie), und was der Server danach schreibt, kommt erst nach `ms` an: so wird „die Tür
// antwortet vor dem Schreiben“ ein fester Ausgang statt eines Zufalls der Plattenzeit
// Mit `nach` wird erst gelesen, was die Zeile mit diesem Text trägt, und dann `ms` gewartet: das nächste Schreiben hängt, die früheren nicht
interface Rohr { rohr: string; ms: number; nach?: string }

const stateDir = process.env.FLEET_STATE_DIR;
const port = process.env.FLEET_PORT;
const token = process.env.FLEET_TOKEN;
if (!stateDir || !port || !token) throw new Error("FLEET_STATE_DIR, FLEET_PORT und FLEET_TOKEN fehlen");
const arg = process.argv[2];
if (!arg) throw new Error("keine Schritte");
const steps = JSON.parse(arg) as (Step | Until | Rohr | "save")[];

const { serveOptions, adoptTokens, loadPersistedState, settleBranchBook, saveStateNow } = await import("../server");
await loadPersistedState(join(stateDir, "fleet.json"));
await settleBranchBook();
adoptTokens();
const fetch = serveOptions.fetch;
if (!fetch) throw new Error("serveOptions hat keinen fetch-Handler");
// der Handler liest vom Server nur die Peer-Adresse (finishHttp)
const server = { requestIP: () => null } as unknown as Parameters<typeof fetch>[1];

const out: { status: number; body: unknown }[] = [];
// "$N.a.b" als ganzer Wert im Body: body.a.b der N-ten Antwort dieses Lebens — für eine Anfrage, die braucht, was eine
// frühere im selben Leben erst gemacht hat (die SHA eines Lands, auf die danach eine Audit-Wache zeigt)
const earlier = (v: unknown): unknown => {
  const ref = typeof v === "string" ? /^\$(\d+)\.([\w.]+)$/.exec(v) : null;
  if (ref) return ref[2]!.split(".").reduce<unknown>((x, k) => (x as Record<string, unknown> | undefined)?.[k], out[Number(ref[1])]?.body);
  if (Array.isArray(v)) return v.map(earlier);
  return v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, earlier(x)])) : v;
};
for (const step of steps) {
  if (step === "save") { await saveStateNow(); continue; }
  if ("rohr" in step) {
    const pfad = join(stateDir, step.rohr);
    rmSync(pfad, { force: true });
    const r = Bun.spawnSync(["mkfifo", pfad]);
    if (r.exitCode !== 0) throw new Error(`mkfifo ${pfad}: ${r.stderr.toString()}`);
    void (async () => {
      if (step.nach === undefined) await Bun.sleep(step.ms);
      let gehalten = false;
      for (;;) {
        const fh = await open(pfad, "r");
        const text = await fh.readFile("utf8");
        await fh.close();
        if (step.nach !== undefined && !gehalten && text.includes(step.nach)) { gehalten = true; await Bun.sleep(step.ms); }
      }
    })();
    out.push({ status: 200, body: { rohr: step.rohr } });
    continue;
  }
  if ("until" in step) {
    const end = Date.now() + step.ms;
    while (!existsSync(step.until) && Date.now() < end) await Bun.sleep(25);
    out.push({ status: existsSync(step.until) ? 200 : 408, body: { until: step.until } });
    continue;
  }
  const auth = step.token === undefined ? token : step.token;
  const headers: Record<string, string> = { host: `127.0.0.1:${port}`, ...(auth ? { authorization: `Bearer ${auth}` } : {}),
    ...(step.self ? { "x-fleet-self-token": step.self } : {}),
    ...(step.body === undefined ? {} : { "content-type": "application/json" }) };
  const res = await fetch.call(server, new Request(`http://127.0.0.1:${port}${step.path}`,
    { method: step.method, headers, ...(step.body === undefined ? {} : { body: JSON.stringify(earlier(step.body)) }) }), server);
  if (!res) throw new Error(`${step.path}: der Handler gab keine Antwort`);
  out.push({ status: res.status, body: await res.json() });
}
process.stdout.write(`${JSON.stringify(out)}\n`);
process.exit(0);
