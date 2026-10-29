// WO DIE SPUR EINES LAUFS LIEGT (e2e/trail-emit.ts#trailHome). Sie gehört neben den Haupt-Checkout,
// damit Läufe aus Lanes und Worktrees in EINER Spur landen. Hinter Fleets Zaun ist der Haupt-Checkout
// aber geschlossen: ein gezäunter Sitz bindet nur seinen Worktree schreibbar ein, `e2e-trail` gibt es
// dort nicht und keiner seiner Eltern lässt sich anlegen. Jede Zeile eines solchen Laufs fiel weg,
// und die sechs Spur-Prüfungen waren rot — an der Umgebung, nicht an der Prüfung. Geprüft wird die
// Entscheidung selbst: beschreibbarer Checkout trägt die Spur, ein unbeschreibbarer bekommt die
// Ausweichstelle, und ohne Baum bleibt es bei ihr.
import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { trailHome } from "../e2e/trail-emit";

const dirs: string[] = [];
const scratch = (name: string): string => { const d = mkdtempSync(join(tmpdir(), `${name}-`)); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) { try { chmodSync(d, 0o700); } catch { /* schon weg */ } rmSync(d, { recursive: true, force: true }); } });

describe("trailHome: wo die Spur liegen darf", () => {
  test("ein beschreibbarer Checkout trägt die Spur neben seinem .git", () => {
    const checkout = scratch("trail-checkout");
    expect(trailHome(join(checkout, ".git"))).toBe(join(checkout, "e2e-trail"));
  });

  test("ein beschreibbares e2e-trail wird genommen, auch wenn der Checkout selbst eng ist", () => {
    const checkout = scratch("trail-checkout");
    mkdirSync(join(checkout, "e2e-trail"));
    expect(trailHome(join(checkout, ".git"))).toBe(join(checkout, "e2e-trail"));
  });

  test.skipIf(process.getuid?.() === 0)("ein unbeschreibbarer Checkout gibt die Ausweichstelle", () => {
    const checkout = scratch("trail-readonly");
    const own = scratch("trail-scratch");
    const fallback = join(own, "fleet-e2e-trail");
    chmodSync(checkout, 0o500);
    expect(trailHome(join(checkout, ".git"), fallback)).toBe(fallback);
    chmodSync(checkout, 0o700);
  });

  test("ohne Baum bleibt es bei der Ausweichstelle", () => {
    const own = scratch("trail-scratch");
    expect(trailHome(null, join(own, "fleet-e2e-trail"))).toBe(join(own, "fleet-e2e-trail"));
  });
});
