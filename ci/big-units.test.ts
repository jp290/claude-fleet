// Owner 22.10.: der Merge-Check fährt die großen e2e-Units, die eine Änderung treffen kann, und bleibt
// schnell, wo sie keine trifft; das Urteil sagt, welche liefen und warum. Geprüft am echten Baum.
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { bigUnitsFor, bigUnitsLine } from "./big-units";
import type { TreeReader } from "../suite-modules";

const ROOT = join(import.meta.dir, "..");
const tree: TreeReader = (p) => existsSync(join(ROOT, p)) && statSync(join(ROOT, p)).isFile() ? readFileSync(join(ROOT, p), "utf8") : null;
const FIVE = ["core", "core-tasks", "programs", "lanes", "watch"];

describe("bigUnitsFor: welche großen Units ein Diff schuldet", () => {
  test("Doku, die nicht in die Instanz kommt, und ci/ schulden keine", () => {
    expect(bigUnitsFor(["docs/neuaufbau/plan.md", "README.md", "ci/merge-check.ts"], tree).run).toEqual([]);
  });
  test("ohne geänderten Pfad keine", () => {
    expect(bigUnitsFor([], tree).run).toEqual([]);
  });
  test("server.ts schuldet jede außer dom, und der Grund nennt server.ts", () => {
    const s = bigUnitsFor(["server.ts"], tree);
    expect(s.run).toEqual(FIVE);
    expect(s.why.programs).toBe("server.ts");
    expect(s.why.dom).toContain("nachts");
  });
  test("eine Moduldatei schuldet nur ihre Unit", () => {
    expect(bigUnitsFor(["e2e/watch.ts"], tree).run).toEqual(["watch"]);
    expect(bigUnitsFor(["e2e/security.ts"], tree).run).toEqual(["core"]);
    expect(bigUnitsFor(["e2e/programs.ts"], tree).run).toEqual(["programs"]);
  });
  test("was e2e-isolated.sh selbst kopiert, gehört jeder Unit (AGENTS.md, .fleet/klassen.json)", () => {
    expect(bigUnitsFor(["AGENTS.md"], tree).run).toEqual(FIVE);
    expect(bigUnitsFor([".fleet/klassen.json"], tree).run).toEqual(FIVE);
  });
  test("die beiden Lands vom 22.10., die main erst im Audit rot machten, schulden ihre roten Units", () => {
    // 993b4e90: rot in e2e/programs.ts
    const a = bigUnitsFor([".fleet/context-packs.json", "docs/packs/who-it-is-for.md", "docs/start/orchestrator.md",
      "server.ts", "server/fassung.test.ts", "server/orchestrator-start.ts", "session-blocks.ts"], tree);
    expect(a.run).toContain("programs");
    // 437e457b: rot in e2e/security.ts (core) und e2e/watch.ts
    const b = bigUnitsFor(["docs/self-api.md", "public/index.html", "src/client.ts", "src/pendingsend.ts",
      "server/warte-hinweis.ts"], tree);
    expect(b.run).toEqual(expect.arrayContaining(["core", "watch"]));
  });
  test("ist der Wrapper nicht lesbar, schuldet der Diff alle außer dom, nie keine", () => {
    const s = bigUnitsFor(["docs/neuaufbau/plan.md"], (p) => p === "e2e-isolated.sh" ? null : tree(p));
    expect(s.run).toEqual(FIVE);
    expect(s.why.core).toContain("nicht ableitbar");
  });
  test("löst sich ein Import nicht auf, schuldet der Diff alle außer dom", () => {
    const s = bigUnitsFor(["docs/neuaufbau/plan.md"], (p) => p === "e2e/harness.ts" ? null : tree(p));
    expect(s.run).toEqual(FIVE);
  });
});

describe("bigUnitsLine: die Zeile im Urteil", () => {
  test("nennt, was lief und wodurch, und was ausblieb und warum", () => {
    const line = bigUnitsLine(bigUnitsFor(["e2e/watch.ts"], tree));
    expect(line).toBe("große Units: watch (e2e/watch.ts) · ausgelassen: core, core-tasks, programs, lanes "
      + "(kein geänderter Pfad im Fußabdruck); dom (läuft nachts, wie im Audit nach dem Land)");
  });
  test("ohne große Unit sagt sie „keine“", () => {
    expect(bigUnitsLine(bigUnitsFor(["docs/neuaufbau/plan.md"], tree))).toStartWith("große Units: keine · ");
  });
});
