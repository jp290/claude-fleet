// WHAT A RESULT LINE CARRIES OF ITS DETAIL (board line a628b113). A DOM rig hands check() its whole
// snapshot, and every call site used to cut it to 1500 characters before the line was written — so a
// red claim's deciding fact (which word, which keys) was gone from run.log and had to be rebuilt with
// a local rig. The call site now hands the detail whole and check() cuts it here: a PASS line stays
// short; a FAIL line keeps its head and names the file in which the whole detail stands, next to the
// run's trail. Head and file name stay under TRAIL_DETAIL_MAX, so the trail row names the file too.
// The line keeps its form `FAIL  <name>  (<detail>)`: the readers cut the name at the first `  (`.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const DETAIL_INLINE_MAX = 1500;
export const DETAIL_CUT = "…";
export const DETAIL_WHOLE_IN = "…[whole detail: ";

// writes one red check's whole detail and answers its path, or null when it could not
export type Spill = (detail: string) => string | null;

export function lineDetail(ok: boolean, detail: string, spill: Spill): string {
  if (detail.length <= DETAIL_INLINE_MAX) return detail;
  const head = detail.slice(0, DETAIL_INLINE_MAX);
  const file = ok ? null : spill(detail);
  return file ? `${head}${DETAIL_WHOLE_IN}${file}]` : `${head}${DETAIL_CUT}`;
}

// one file per red check, numbered in run order. null dir (the trail is switched off) or a failed
// write answers null: like the trail, the spill never changes a run's outcome.
export function spillTo(dir: string | null): Spill {
  let n = 0;
  return (detail) => {
    if (!dir) return null;
    const file = join(dir, `${++n}.txt`);
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, detail);
      return file;
    } catch {
      return null;
    }
  };
}
