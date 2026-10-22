// Befund F4 der Sicherheitsprüfung: eine Session öffnet über ihre Self-Tür keinen Sitz, der weiter ist als sie selbst
// (server/kind-weite.ts, docs/self-api.md §branches). Die Gegenprobe am laufenden Server steht in ohne-owner-token.test.ts.
import { describe, expect, test } from "bun:test";
import { kindNieWeiter, spawnNieWeiter, type Oeffnerin } from "./kind-weite";

const AUTO: Oeffnerin = { harness: "claude", modus: "auto", permissions: null, rechte: null };
const ORCH: Oeffnerin = { ...AUTO, modus: "bypassPermissions" };
const CODEX = (sandbox: "read-only" | "workspace-write" | "danger-full-access", approval: "on-request" | "never"): Oeffnerin =>
  ({ harness: "codex", modus: null, permissions: { sandbox, approval }, rechte: null });
const OHNE_SANDBOX = { sandbox: "danger-full-access", approval: "never" };

describe("eine Öffnerin unter dem Klassifizierer", () => {
  test("öffnet kein Codex ohne Sandbox, auch nicht mit Codex' eigenem Standard", () => {
    for (const body of [{ branch: "b", harness: "codex", permissions: OHNE_SANDBOX }, { branch: "b", harness: "codex" },
      { branch: "b", harness: "codex", permissions: { sandbox: "read-only", approval: "on-request" } }]) {
      const r = kindNieWeiter(AUTO, body);
      expect(r.ok ? "geöffnet" : r.error).toContain("harness codex is not yours (claude)");
    }
  });
  test("öffnet keinen anderen Harness, auch keinen unbekannten", () => {
    for (const harness of ["pi", "pi-zai", "container", "gibtsnicht"])
      expect(kindNieWeiter(AUTO, { branch: "b", harness }).ok).toBe(false);
  });
  test("öffnet Claude Code wie bisher; ohne Angabe erbt das Kind ihren Harness und ihre (keine) Rechte", () => {
    expect(kindNieWeiter(AUTO, { branch: "b", goal: "g" })).toEqual({ ok: true, body: { branch: "b", goal: "g", harness: "claude", rechte: null } });
    expect(kindNieWeiter(AUTO, { branch: "b", harness: "claude" }).ok).toBe(true);
  });
  test("mit Rechten „bauen“: das Kind erbt sie, ohne Regeln (Landen dem Klassifizierer überlassen) oder mit „landen“ nicht", () => {
    const bauen: Oeffnerin = { ...AUTO, rechte: { stufe: "bauen", an: [], aus: [] } };
    expect(kindNieWeiter(bauen, { branch: "b" })).toEqual({ ok: true, body: { branch: "b", harness: "claude", rechte: bauen.rechte } });
    const ohne = kindNieWeiter(bauen, { branch: "b", rechte: null });
    expect(ohne.ok ? "geöffnet" : ohne.error).toContain("rechte give landen, deploy, verwerfen more than yours");
    expect(kindNieWeiter(bauen, { branch: "b", rechte: { stufe: "landen" } }).ok).toBe(false);
    expect(kindNieWeiter(bauen, { branch: "b", rechte: { stufe: "bauen", an: ["landen"] } }).ok).toBe(false);
    expect(kindNieWeiter(bauen, { branch: "b", rechte: { stufe: "lesen" } }).ok).toBe(true);
    expect(kindNieWeiter(bauen, { branch: "b", rechte: { stufe: "bauen", aus: ["dateien"] } }).ok).toBe(true);
  });
  test("ohne Rechte: ein Kind mit „landen“ (ohne Rückfrage) ist weiter, eins mit „lesen“ enger", () => {
    expect(kindNieWeiter(AUTO, { branch: "b", rechte: { stufe: "landen" } }).ok).toBe(false);
    expect(kindNieWeiter(AUTO, { branch: "b", rechte: { stufe: "deployen" } }).ok).toBe(false);
    expect(kindNieWeiter(AUTO, { branch: "b", rechte: { stufe: "lesen" } }).ok).toBe(true);
    expect(kindNieWeiter(AUTO, { branch: "b", rechte: { stufe: "bauen" } }).ok).toBe(true);
  });
  test("mit Rechten „lesen“: ein Kind ohne Rechte dürfte Dateien ändern", () => {
    const lesen: Oeffnerin = { ...AUTO, rechte: { stufe: "lesen", an: [], aus: [] } };
    expect(kindNieWeiter(lesen, { branch: "b", rechte: null }).ok).toBe(false);
  });
  test("unlesbare Rechte gehen unverändert weiter: openBoardBranch lehnt sie mit seinem eigenen Satz ab", () => {
    expect(kindNieWeiter(AUTO, { branch: "b", rechte: "alles" })).toEqual({ ok: true, body: { branch: "b", harness: "claude", rechte: "alles" } });
  });
});

describe("eine Codex-Öffnerin mit Sandbox", () => {
  test("öffnet kein weiteres Codex und kein Claude Code", () => {
    const ws = CODEX("workspace-write", "on-request");
    expect(kindNieWeiter(ws, { branch: "b", harness: "codex", permissions: OHNE_SANDBOX }).ok).toBe(false);
    expect(kindNieWeiter(ws, { branch: "b", harness: "codex", permissions: { sandbox: "workspace-write", approval: "never" } }).ok).toBe(false);
    expect(kindNieWeiter(ws, { branch: "b", harness: "claude" }).ok).toBe(false);
    expect(kindNieWeiter(CODEX("danger-full-access", "on-request"), { branch: "b", harness: "codex", permissions: OHNE_SANDBOX }).ok).toBe(false);
  });
  test("ohne Angabe erbt das Kind ihren Harness und ihre Schranken statt Codex' Standard danger-full-access/never", () => {
    expect(kindNieWeiter(CODEX("read-only", "on-request"), { branch: "b" }))
      .toEqual({ ok: true, body: { branch: "b", harness: "codex", permissions: { sandbox: "read-only", approval: "on-request" } } });
  });
  test("öffnet dieselben oder engere Schranken", () => {
    const ws = CODEX("workspace-write", "never");
    expect(kindNieWeiter(ws, { branch: "b", harness: "codex", permissions: { sandbox: "workspace-write", approval: "never" } }).ok).toBe(true);
    expect(kindNieWeiter(ws, { branch: "b", permissions: { sandbox: "read-only", approval: "on-request" } }).ok).toBe(true);
  });
  test("ohne lesbare eigene Schranken gilt die engste", () => {
    const kaputt: Oeffnerin = { harness: "codex", modus: null, permissions: null, rechte: null };
    expect(kindNieWeiter(kaputt, { branch: "b" }))
      .toEqual({ ok: true, body: { branch: "b", harness: "codex", permissions: { sandbox: "read-only", approval: "on-request" } } });
    expect(kindNieWeiter(kaputt, { branch: "b", permissions: { sandbox: "workspace-write", approval: "on-request" } }).ok).toBe(false);
  });
});

describe("eine Öffnerin ohne Schranke öffnet, was sie heute öffnet", () => {
  test("die Orchestratorin (bypassPermissions): Codex ohne Sandbox, Rechte, Body unverändert", () => {
    const body = { branch: "b", harness: "codex", permissions: OHNE_SANDBOX };
    expect(kindNieWeiter(ORCH, body)).toEqual({ ok: true, body });
    expect(kindNieWeiter(ORCH, { branch: "b" })).toEqual({ ok: true, body: { branch: "b" } });
    expect(kindNieWeiter(ORCH, { branch: "b", rechte: { stufe: "deployen" } }).ok).toBe(true);
  });
  test("Codex mit danger-full-access und never", () => {
    expect(kindNieWeiter(CODEX("danger-full-access", "never"), { branch: "b", harness: "claude" }).ok).toBe(true);
  });
});

describe("die Aufgaben-Türen fragen nur Harness und Codex-Schranken (eine Lane trägt keine Rechte)", () => {
  test("eine Claude-Öffnerin in auto: kein Codex, ihr Harness ergänzt, keine Rechte im Body", () => {
    expect(spawnNieWeiter(AUTO, { harness: "codex", permissions: OHNE_SANDBOX }).ok).toBe(false);
    expect(spawnNieWeiter(AUTO, { harness: "codex" }).ok).toBe(false);
    expect(spawnNieWeiter({ ...AUTO, rechte: { stufe: "lesen", an: [], aus: [] } }, { text: "t" }))
      .toEqual({ ok: true, body: { text: "t", harness: "claude" } });
  });
  test("eine Codex-Öffnerin in workspace-write: ohne Angabe ihre Schranken, weitere abgelehnt", () => {
    const ws = CODEX("workspace-write", "on-request");
    expect(spawnNieWeiter(ws, { model: "m" })).toEqual({ ok: true,
      body: { model: "m", harness: "codex", permissions: { sandbox: "workspace-write", approval: "on-request" } } });
    expect(spawnNieWeiter(ws, { harness: "codex", permissions: OHNE_SANDBOX }).ok).toBe(false);
  });
  test("die Orchestratorin: unverändert", () => {
    expect(spawnNieWeiter(ORCH, { harness: "codex" })).toEqual({ ok: true, body: { harness: "codex" } });
  });
});
