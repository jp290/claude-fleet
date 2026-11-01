// EINE NEUE SELF-ROUTE OHNE EINTRAG IN DER PRE-AUTH-LISTE IST LOKAL ROT (W3 Auftrag 13): bisher prüfte nur e2e/security.ts §1 die Routen vor dem
// Owner-Tor, und das läuft nur in der vollen Suite auf dem Helfer — ein Branch mit einer neuen Self-Route sah lokal grün aus. Dieser Test liegt in
// ./server und läuft damit im Job `local` des Merge-Checks (ci/unit-tests.ts) und bei jedem `bun test ./server` eines Bauers: derselbe Leser
// (e2e/pre-auth-routes.ts#routeSet), dieselbe Region, dieselbe Liste. Die Form-Prüfungen (unrecognized, Aliase) bleiben in security.ts.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PRE_AUTH_ROUTES, pathAliases, preAuthRegion, routeSet, unrecognized } from "../e2e/pre-auth-routes";

const SERVER = readFileSync(join(import.meta.dir, "..", "server.ts"), "utf8");
const abweichung = (src: string): { unexpected: string[]; missing: string[] } => {
  const found = routeSet(preAuthRegion(src));
  return { unexpected: found.filter((r) => !PRE_AUTH_ROUTES.includes(r)), missing: PRE_AUTH_ROUTES.filter((r) => !found.includes(r)) };
};

describe("die Routen vor dem Owner-Tor sind die geprüfte Liste", () => {
  test("server.ts: jede Route vor dem Owner-Tor steht in PRE_AUTH_ROUTES, und jeder Eintrag ist eine Route (eine neue Self-Route braucht ihren Eintrag in e2e/pre-auth-routes.ts)", () => {
    expect(preAuthRegion(SERVER).length).toBeGreaterThan(1000);
    expect(abweichung(SERVER)).toEqual({ unexpected: [], missing: [] });
  });
  test("eine Self-Route vor dem Owner-Tor ohne Eintrag wird genannt", () => {
    const probe = SERVER.replace("async fetch(req, server) {",
      'async fetch(req, server) {\n    if (url.pathname === "/api/self/ohne-eintrag" && req.method === "GET") return json({ ok: true });');
    expect(abweichung(probe)).toEqual({ unexpected: ["= /api/self/ohne-eintrag"], missing: [] });
  });
});

// F2 (W3 Auftrag 15): der Leser oben kennt zwei Formen. Eine Route in einer anderen Form muss genannt werden, nicht grün bleiben — darum fährt
// derselbe strenge Leser wie in security.ts §1 jetzt auch hier, über die echte Region und über je eine Probe der Idiome, die der Prüfer fand.
const einsetzen = (zeilen: string): string => SERVER.replace("async fetch(req, server) {", `async fetch(req, server) {\n    ${zeilen}`);
const genannt = (src: string): string[] => { const r = preAuthRegion(src); return [...unrecognized(r), ...pathAliases(r)]; };

describe("eine Pfad-Form, die der Leser nicht versteht, bleibt nicht grün", () => {
  test("server.ts: vor dem Owner-Tor liest jede Zeile den Pfad in einer Form, die der Leser kennt", () => {
    expect(genannt(SERVER)).toEqual([]);
  });
  const idiome: [string, string][] = [
    ["startsWith", 'if (url.pathname.startsWith("/api/self/hintertuer")) return json({ ok: true });'],
    ['["…"].includes', 'if (["/api/self/hintertuer"].includes(url.pathname)) return json({ ok: true });'],
    ["umgedrehtes ===", 'if ("/api/self/hintertuer" === url.pathname) return json({ ok: true });'],
    ["Regex in einer Konstante", 'const HINTER = /^\\/api\\/self\\/hintertuer$/;\n    if (HINTER.test(url.pathname)) return json({ ok: true });'],
    ["die Share-Liste um einen Pfad länger", 'const pub2 = ["/share.js", "/xterm.css", "/icon.svg", "/icon-180.png", "/favicon.ico", "/api/self/hintertuer"].includes(url.pathname);'],
  ];
  for (const [form, zeilen] of idiome) test(`${form}: die Route fehlt im Routen-Satz, und der strenge Leser nennt ihre Zeile`, () => {
    const probe = einsetzen(zeilen);
    expect(routeSet(preAuthRegion(probe)).some((r) => r.includes("hintertuer"))).toBe(false);
    expect(genannt(probe).some((z) => z.includes("hintertuer") || z.includes("HINTER"))).toBe(true);
  });
});
