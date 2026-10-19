// Host disk admission, the arithmetic. server.ts#measureHostDiskSpace reads the filesystem under
// tmpdir() and asks this whether a local heavy start (a land gate, the post-land audit) may go.
//
// The floor (FLEET_DISK_MIN_FREE_GIB, 4) and the reserve per running local suite
// (FLEET_DISK_WRITER_GIB, 3,6) are fixed sizes chosen on the Mac. On a filesystem smaller than the
// floor they can never be met: the Workhorse's /tmp is a 3,84-GiB tmpfs, and from cc65daa1
// (2026-10-08) on every local audit there was held, empty disk or not. So each is capped at a
// quarter of the filesystem's size. On a disk of 16 GiB or more nothing changes; an empty
// filesystem is ready while at most three suites run. A size that could not be read caps nothing.
export interface DiskAdmissionInput {
  freeBytes: number | null;
  totalBytes: number | null;
  runningWriters: number;
  minFreeBytes: number;
  writerBytes: number;
}
export interface DiskAdmission {
  held: boolean;
  minimumFreeBytes: number;
  writerReserveBytes: number;
  reservedBytes: number;
  availableBytes: number | null;
}
export function diskAdmission(i: DiskAdmissionInput): DiskAdmission {
  const cap = i.totalBytes !== null && Number.isFinite(i.totalBytes) && i.totalBytes > 0 ? i.totalBytes / 4 : Infinity;
  const minimumFreeBytes = Math.min(i.minFreeBytes, cap);
  const writerReserveBytes = Math.min(i.writerBytes, cap);
  const reservedBytes = i.runningWriters * writerReserveBytes;
  const availableBytes = i.freeBytes === null ? null : i.freeBytes - reservedBytes;
  return { held: availableBytes === null || availableBytes < minimumFreeBytes,
    minimumFreeBytes, writerReserveBytes, reservedBytes, availableBytes };
}
