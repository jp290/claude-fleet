import { describe, expect, test } from "bun:test";
import {
  AUTO_MODE_BRIEF, PERMISSION_MODE, fillEnvironment, hubHostOf, startAspects,
  withoutSkipPermissions, type ClaudeStartRole, type StartFacts,
} from "./session-start";
import { AUTOMODE_ENVIRONMENT } from "./automode-environment";

const ROLES: ClaudeStartRole[] = ["lane", "main", "orchestrator", "generic"];
const HUB = { remote: "hub", url: "ssh://helper@10.1.2.3/~/git/fleet.git", host: "helper@10.1.2.3" };
const facts = (over: Partial<StartFacts> = {}): StartFacts =>
  ({ role: "lane", handoverOn: true, fleetUrl: "http://10.9.9.9:8790", tmuxSocket: "fleetsock", hub: HUB, ...over });

describe("Owner 15.10.: „[Zitat entfernt]“", () => {
  test("every role Fleet spawns starts in auto", () => {
    for (const role of ROLES) expect(startAspects(facts({ role })).mode).toBe("auto");
    expect(Object.keys(PERMISSION_MODE).sort()).toEqual([...ROLES].sort());
  });

  test("the bypass flag of an old FLEET_CMD is taken off the line, every other token stays", () => {
    expect(withoutSkipPermissions("claude --dangerously-skip-permissions")).toBe("claude");
    expect(withoutSkipPermissions("claude  --dangerously-skip-permissions --verbose")).toBe("claude --verbose");
    expect(withoutSkipPermissions("claude")).toBe("claude");
    // a look-alike flag is not the bypass flag
    expect(withoutSkipPermissions("claude --allow-dangerously-skip-permissions")).toBe("claude --allow-dangerously-skip-permissions");
  });

  test("every session reads the auto-mode brief line at its start", () => {
    for (const role of ROLES) expect(startAspects(facts({ role })).briefLine).toBe(AUTO_MODE_BRIEF);
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
