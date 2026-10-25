import { expect, test } from "bun:test";
import { markCell } from "./marks";

// A row at layout y=200, 20 wide, in a host at the origin. At zoom z the browser reports every length z times larger.
const at = (z: number) =>
  markCell({ left: 10 * z, bottom: 220 * z, width: 20 * z, height: 20 * z }, { left: 0, top: 0 }, { left: 0, top: 30 }, { left: 0, top: 0 }, z);

test("a plant sits at the same place in the bar's own px at any rail zoom", () => {
  const base = at(1);
  expect(base).toEqual({ x: 10, y: 230, size: 20 });
  for (const z of [0.8, 1.25]) expect(at(z)).toEqual(base);
});
