import { describe, expect, test } from "bun:test";
import { diskAdmission } from "./disk-space";

const GiB = 1024 ** 3;
const DEFAULTS = { minFreeBytes: 4 * GiB, writerBytes: 3.6 * GiB };
const TMPFS = 3.84 * GiB;

describe("disk admission on a filesystem smaller than the floor (Workhorse /tmp, 3,84 GiB tmpfs)", () => {
  test("empty and no suite running: ready", () => {
    const a = diskAdmission({ ...DEFAULTS, freeBytes: TMPFS, totalBytes: TMPFS, runningWriters: 0 });
    expect(a.held).toBe(false);
    expect(a.minimumFreeBytes).toBe(TMPFS / 4);
    expect(a.writerReserveBytes).toBe(TMPFS / 4);
  });
  test("empty with three suites running: still ready", () => {
    expect(diskAdmission({ ...DEFAULTS, freeBytes: TMPFS, totalBytes: TMPFS, runningWriters: 3 }).held).toBe(false);
  });
  test("should hold when full: 0,5 GiB free of 3,84", () => {
    const a = diskAdmission({ ...DEFAULTS, freeBytes: 0.5 * GiB, totalBytes: TMPFS, runningWriters: 0 });
    expect(a.held).toBe(true);
    expect(a.availableBytes).toBe(0.5 * GiB);
  });
  test("should hold an empty filesystem with four suites running", () => {
    expect(diskAdmission({ ...DEFAULTS, freeBytes: TMPFS, totalBytes: TMPFS, runningWriters: 4 }).held).toBe(true);
  });
});

describe("disk admission on a large disk (Mac, 500 GiB): unchanged", () => {
  const MAC = 500 * GiB;
  test("the floor stays 4 GiB and the reserve 3,6 GiB", () => {
    const a = diskAdmission({ ...DEFAULTS, freeBytes: 100 * GiB, totalBytes: MAC, runningWriters: 0 });
    expect(a.minimumFreeBytes).toBe(4 * GiB);
    expect(a.writerReserveBytes).toBe(3.6 * GiB);
  });
  test("3 GiB free holds, exactly 4 GiB free is ready", () => {
    expect(diskAdmission({ ...DEFAULTS, freeBytes: 3 * GiB, totalBytes: MAC, runningWriters: 0 }).held).toBe(true);
    expect(diskAdmission({ ...DEFAULTS, freeBytes: 4 * GiB, totalBytes: MAC, runningWriters: 0 }).held).toBe(false);
  });
  test("12 GiB free: two suites leave 4,8 GiB and are ready, three reserve 10,8 GiB and hold", () => {
    expect(diskAdmission({ ...DEFAULTS, freeBytes: 12 * GiB, totalBytes: MAC, runningWriters: 2 }).held).toBe(false);
    const three = diskAdmission({ ...DEFAULTS, freeBytes: 12 * GiB, totalBytes: MAC, runningWriters: 3 });
    expect(three.held).toBe(true);
    expect(three.reservedBytes).toBe(3 * 3.6 * GiB);
  });
  test("a disk of exactly 16 GiB keeps the 4-GiB floor", () => {
    expect(diskAdmission({ ...DEFAULTS, freeBytes: 16 * GiB, totalBytes: 16 * GiB, runningWriters: 0 }).minimumFreeBytes).toBe(4 * GiB);
  });
});

describe("disk admission with a reading that failed", () => {
  test("should hold when free space is unknown", () => {
    const a = diskAdmission({ ...DEFAULTS, freeBytes: null, totalBytes: TMPFS, runningWriters: 0 });
    expect(a.held).toBe(true);
    expect(a.availableBytes).toBeNull();
  });
  test("an unknown or malformed size caps nothing: 3,84 GiB free against the full 4-GiB floor holds", () => {
    for (const totalBytes of [null, Number.NaN, 0, -1, Number.POSITIVE_INFINITY]) {
      const a = diskAdmission({ ...DEFAULTS, freeBytes: TMPFS, totalBytes, runningWriters: 0 });
      expect([totalBytes, a.held, a.minimumFreeBytes]).toEqual([totalBytes, true, 4 * GiB]);
    }
  });
});
