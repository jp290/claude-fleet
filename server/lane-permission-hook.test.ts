import { describe, expect, test } from "bun:test";
import { AUTO_MODE_TOOL_PREFIX, decide } from "../.claude/hooks/lane-permission";
import { harnessBlockMessage } from "../lane-signals";

const LANE = { FLEET_SELF_LANE: "1", FLEET_SELF_TOKEN: "t" };
const denied = (over: Record<string, unknown> = {}): string => JSON.stringify({
  hook_event_name: "PermissionDenied", permission_mode: "auto", tool_name: "Bash",
  tool_input: { command: "curl -X POST http://h:8790/api/deploy" }, tool_use_id: "x", reason: "[Production Deploy]", ...over,
});

describe("an auto-mode deny in a lane is reported, never decided (K16 E6)", () => {
  test("the lane's hook reports it as a denied row whose tool names the classifier", () => {
    const out = decide(denied(), LANE);
    expect(out.kind).toBe("report");
    if (out.kind !== "report") return;
    expect(out.report.signal).toBe("denied");
    expect(out.report.tool).toBe(`${AUTO_MODE_TOOL_PREFIX}Bash`);
    expect(out.report.detail).toBe("[Production Deploy] curl -X POST http://h:8790/api/deploy");
  });

  test("a credential-shaped run in the request does not travel on", () => {
    const out = decide(denied({ tool_input: { command: `curl -H "x: ${"a1".repeat(20)}" http://h` } }), LANE);
    expect(out.kind === "report" && out.report.detail.includes("a1a1a1a1a1a1a1a1")).toBe(false);
  });

  test("a long tool name keeps the prefix inside the server's 64 characters", () => {
    const out = decide(denied({ tool_name: "m".repeat(80) }), LANE);
    expect(out.kind === "report" && out.report.tool?.length).toBe(64);
    expect(out.kind === "report" && out.report.tool?.startsWith(AUTO_MODE_TOOL_PREFIX)).toBe(true);
  });

  test("outside a lane the hook stays silent", () => {
    expect(decide(denied(), { FLEET_SELF_TOKEN: "t" }).kind).toBe("pass");
  });

  test("the receiver reads that the classifier denied it, not a dialog", () => {
    const text = harnessBlockMessage(4, "bau/x", { id: "e1", kind: "harness-block",
      payload: { signal: "denied", tool: `${AUTO_MODE_TOOL_PREFIX}Bash`, detail: "[Production Deploy] curl", key: "k", count: 1, escalated: false } });
    expect(text).toContain("auto-mode classifier DENIED a Bash call");
    expect(text).not.toContain("asked a human to approve");
  });
});
