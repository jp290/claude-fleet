import { describe, expect, test } from "bun:test";
import {
  AUTO_MODE_BRIEF, PERMISSION_MODE, REAL_SEAT_DENY, fillEnvironment, hubHostOf, slotSpawnFrom, spawnListRole, startAspects,
  withoutSkipPermissions, type ClaudeStartRole, type StartFacts,
} from "./session-start";
import { AUTOMODE_ENVIRONMENT } from "./automode-environment";
import { autoCompactOff, fleetChoiceOf } from "./succession";

const ROLES: ClaudeStartRole[] = ["lane", "main", "orchestrator", "generic"];
const HUB = { remote: "hub", url: "ssh://helper@10.1.2.3/~/git/fleet.git", host: "helper@10.1.2.3" };
const facts = (over: Partial<StartFacts> = {}): StartFacts =>
  ({ role: "lane", handoverOn: true, fleetUrl: "http://10.9.9.9:8790", tmuxSocket: "fleetsock", hub: HUB, ...over });

describe("Owner 15.10.: „[Zitat entfernt]“", () => {
  test("every role Fleet spawns starts in auto, the Orchestratorin in bypass (owner 20.10.)", () => {
    for (const role of ROLES) expect(startAspects(facts({ role })).mode).toBe(role === "orchestrator" ? "bypassPermissions" : "auto");
    expect(Object.keys(PERMISSION_MODE).sort()).toEqual([...ROLES].sort());
  });

  test("the bypass flag of an old FLEET_CMD is taken off the line, every other token stays", () => {
    expect(withoutSkipPermissions("claude --dangerously-skip-permissions")).toBe("claude");
    expect(withoutSkipPermissions("claude  --dangerously-skip-permissions --verbose")).toBe("claude --verbose");
    expect(withoutSkipPermissions("claude")).toBe("claude");
    // a look-alike flag is not the bypass flag
    expect(withoutSkipPermissions("claude --allow-dangerously-skip-permissions")).toBe("claude --allow-dangerously-skip-permissions");
  });

  test("owner 22.10. „[Zitat entfernt]“ on a test instance: with noBypass no role starts in bypass, the Orchestratorin included", () => {
    for (const role of ROLES) {
      expect(startAspects(facts({ role, noBypass: true })).mode).toBe("auto");
      expect(startAspects(facts({ role, noBypass: true })).briefLine).toBe(AUTO_MODE_BRIEF);
    }
    expect(startAspects(facts({ role: "orchestrator", noBypass: false })).mode).toBe("bypassPermissions");
  });

  test("a real seat (noBypass) denies starting another claude by name and by path; a live seat has no such rule", () => {
    for (const role of ROLES) expect(startAspects(facts({ role, noBypass: true })).settings.permissions?.deny).toEqual([...REAL_SEAT_DENY]);
    expect(REAL_SEAT_DENY).toEqual(["Bash(claude:*)", "Bash(*/claude *)", "Bash(*/claude)"]);
    expect(startAspects(facts({ role: "lane" })).settings.permissions).toBeUndefined();
  });

  test("every auto session reads the auto-mode brief line at its start, a bypass session none", () => {
    for (const role of ROLES) expect(startAspects(facts({ role })).briefLine).toBe(role === "orchestrator" ? null : AUTO_MODE_BRIEF);
    expect(AUTO_MODE_BRIEF).toContain("nicht umgehen");
  });
});

describe("Owner 15.10.: „[Zitat entfernt]“", () => {
  test("handover on at the spawn → Claude Code's own compaction is off", () => {
    expect(startAspects(facts({ handoverOn: true })).settings.autoCompactEnabled).toBe(false);
  });

  test("handover off → the key is absent, so Claude Code's compaction stays the last hold", () => {
    const s = startAspects(facts({ handoverOn: false })).settings;
    expect("autoCompactEnabled" in s).toBe(false);
  });

  // Bauleitung 18.10. (b), after the owner's „[Zitat entfernt]“ (Z132): the fleet's value is the hint, so the start line keeps Claude
  // Code's compaction; only a session that chose Fleet's act at the cap starts with it off
  test("the fleet's value (hint) → the start line keeps Claude Code's compaction; a chosen new session turns it off", () => {
    const at = (choice: "hint" | "compact" | "succeed") => startAspects(facts({ handoverOn: autoCompactOff(40, choice) })).settings;
    expect("autoCompactEnabled" in at(fleetChoiceOf("session"))).toBe(false);
    expect(at("succeed").autoCompactEnabled).toBe(false);
    expect(at("compact").autoCompactEnabled).toBe(false);
  });
});

describe("the classifier environment (befunde/18 §3.2)", () => {
  const template = AUTOMODE_ENVIRONMENT;

  test("keeps the built-in entries and fills Fleet's own facts", () => {
    const env = startAspects(facts()).settings.autoMode.environment;
    expect(env[0]).toBe("$defaults");
    expect(env.some((e) => e.includes("http://10.9.9.9:8790/api/deploy"))).toBe(true);
    expect(env.some((e) => e.includes("ssh helper@10.1.2.3"))).toBe(true);
    expect(env.some((e) => e.includes("tmux -L fleetsock"))).toBe(true);
    expect(env.some((e) => e.includes("never pushed"))).toBe(true);
    expect(env.join("\n")).not.toMatch(/\{[a-zA-Z]+\}/);
  });

  test("without a hub remote the hub entries are dropped whole, nothing half-filled remains", () => {
    const env = fillEnvironment(template, facts({ hub: null }));
    expect(env.length).toBe(template.length - template.filter((e) => /\{hub/.test(e)).length);
    expect(env.some((e) => e.includes("ssh "))).toBe(false);
    expect(env.join("\n")).not.toMatch(/\{[a-zA-Z]+\}/);
    expect(env.some((e) => e.includes("http://10.9.9.9:8790"))).toBe(true);
  });

  test("the tracked template names no address of this machine", () => {
    expect(template.join("\n")).not.toMatch(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
  });

});

describe("hubHostOf", () => {
  test("ssh and scp forms give user@host", () => {
    expect(hubHostOf("ssh://helper@10.1.2.3/~/git/fleet.git")).toBe("helper@10.1.2.3");
    expect(hubHostOf("ssh://helper@10.1.2.3:2222/~/git/fleet.git")).toBe("helper@10.1.2.3");
    expect(hubHostOf("helper@10.1.2.3:git/fleet.git")).toBe("helper@10.1.2.3");
  });

  test("a local path, https or an empty string is no ssh hub", () => {
    expect(hubHostOf("/srv/git/fleet.git")).toBe(null);
    expect(hubHostOf("https://github.com/x/fleet.git")).toBe(null);
    expect(hubHostOf("")).toBe(null);
  });
});

describe("Bauleitung 16.10.: welche Werkzeuge eine laufende MAIN wirklich hat — die Rolle ihres letzten Starts", () => {
  const spawn = (over: Partial<Parameters<typeof spawnListRole>[0]> = {}) =>
    spawnListRole({ claude: true, lane: false, orchestrator: false, boundMain: false, ...over });

  test("a MAIN bound at her spawn starts as main, a MAIN founded unbound as generic", () => {
    expect(spawn({ boundMain: true })).toBe("main");
    expect(spawn()).toBe("generic");
  });

  test("a lane starts as lane and the Orchestratorin as orchestrator, whatever else holds", () => {
    expect(spawn({ lane: true, orchestrator: true, boundMain: true })).toBe("lane");
    expect(spawn({ orchestrator: true, boundMain: true })).toBe("orchestrator");
  });

  test("a foreign harness records no role", () => {
    expect(spawnListRole({ claude: false, lane: true, orchestrator: false, boundMain: false })).toBeNull();
    expect(spawnListRole({ claude: false, lane: false, orchestrator: false, boundMain: true })).toBeNull();
  });

  test("the record survives the state file for its own occupation and for no other", () => {
    for (const role of ROLES) {
      const saved = JSON.parse(JSON.stringify({ role, openedAt: 4711 }));
      expect(slotSpawnFrom(saved, 4711)).toEqual({ role, openedAt: 4711 });
      expect(slotSpawnFrom(saved, 4712)).toBeNull();
      // a record written while it still carried `at` (8bdd80b7) loads, without it
      expect(slotSpawnFrom({ role, openedAt: 4711, at: 1_792_000_000_000 }, 4711)).toEqual({ role, openedAt: 4711 });
    }
  });

  test("a malformed record loads as none", () => {
    expect(slotSpawnFrom(undefined, 1)).toBeNull();
    // eigenes Setup: nur ein Sitz ohne Rolle trägt es
    expect(slotSpawnFrom({ role: "generic", openedAt: 1, eigen: true }, 1)).toEqual({ role: "generic", openedAt: 1, eigen: true });
    expect(slotSpawnFrom({ role: "lane", openedAt: 1, eigen: true }, 1)).toEqual({ role: "lane", openedAt: 1 });
    expect(slotSpawnFrom(null, 1)).toBeNull();
    expect(slotSpawnFrom("main", 1)).toBeNull();
    expect(slotSpawnFrom({ role: "bau", openedAt: 1 }, 1)).toBeNull();
    expect(slotSpawnFrom({ role: "main", openedAt: "1" }, 1)).toBeNull();
    expect(slotSpawnFrom({ role: "main" }, 1)).toBeNull();
    expect(slotSpawnFrom({ openedAt: 1 }, 1)).toBeNull();
  });
});
