// The denominator a session publishes on the board is one number, and it may only ever be the
// number the start window already shows for that model: model-register.ts#displayWindow. This file
// holds protocol.ts#contextWindowFor against the register, so a model added there cannot go live
// with a full context bar and no fill (owner-side symptom, 27.10.: a pi seat on DeepSeek shows no
// context state while pi's own footer reads 1.0M).
//
// It also holds the other direction: an id the register does not name gets NO window, because a
// denominator invented for an unknown id makes the bar lie in the one case where nobody measured.
import { describe, expect, test } from "bun:test";
import { MODEL_REGISTER, modelsForHarness, type ModelHarness } from "../model-register";
import { contextWindowFor } from "./protocol";

// The pi adapters this fleet can start. `pi` itself carries no register models today, and asking for
// them anyway is the point: the moment one is added, (b) below has to answer.
const PI_HARNESSES: ModelHarness[] = ["pi", "pi-zai", "pi-zai-unfenced", "pi-deepseek"] as ModelHarness[];

describe("contextWindowFor reads its denominators from the register", () => {
  // Codex is out: its window is not this number but the one the rollout file carries (server.ts,
  // `windowFromFile`), and contextWindowFor's 258,400 for gpt ids is the USABLE share, not the
  // nominal 272,000 the register displays. Every row here is therefore a claim about a claude or a
  // pi adapter.
  const priced = MODEL_REGISTER.filter((e) => e.displayWindow !== undefined && e.harness !== "codex");

  test("(a) every register row's window is the one contextWindowFor returns", () => {
    const wrong = priced
      .filter((e) => contextWindowFor(e.id) !== e.displayWindow)
      .map((e) => `${e.harness}/${e.id}: register ${e.displayWindow}, contextWindowFor ${contextWindowFor(e.id)}`);
    expect(wrong).toEqual([]);
    // a filter that silently matches nothing would pass the line above
    expect(priced.length).toBeGreaterThan(10);
  });

  test("(b) every model a pi adapter can start has a window", () => {
    const missing = PI_HARNESSES.flatMap((h) => modelsForHarness(h)
      .filter((id) => contextWindowFor(id) === null)
      .map((id) => `${h}/${id}`));
    expect(missing).toEqual([]);
    // the two DeepSeek ids are the reason this file exists, so their presence is asserted by name
    expect(contextWindowFor("deepseek-flash")).toBe(1_000_000);
    expect(contextWindowFor("deepseek-v4-pro")).toBe(1_000_000);
  });

  test("(c) an id the register does not name keeps no window", () => {
    expect(contextWindowFor("deepseek-9")).toBeNull();
    expect(contextWindowFor("glm-5.2")).toBeNull();
    expect(contextWindowFor("zai/glm-5.3")).toBeNull();
    expect(contextWindowFor(null)).toBeNull();
  });
});
