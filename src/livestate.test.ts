import { expect, test } from "bun:test";
import { liveWord } from "./livestate";

const ready = (agents: number, shells: number) => ({ turn: "ready" as const, detail: null, background: { agents, shells } });

test("a background command alone leaves the line at „bereit“", () => {
  expect(liveWord(ready(0, 1))).toEqual({ word: "bereit", kind: "idle" });
});
test("a running subagent makes it „arbeitet im Hintergrund“, with or without commands", () => {
  expect(liveWord(ready(1, 0))).toEqual({ word: "arbeitet im Hintergrund", kind: "work" });
  expect(liveWord(ready(1, 2))).toEqual({ word: "arbeitet im Hintergrund", kind: "work" });
});
