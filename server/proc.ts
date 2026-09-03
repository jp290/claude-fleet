// Process and output hygiene, lifted out of server.ts unchanged: the byte-capped retention every
// captured run log passes through, and the depth-bounded process-tree kill that both the verify
// gate and the post-land audit escalate with. Neither has anything to do with the callers' own
// budgets (VERIFY_OUT_CAP, POSTLAND_AUDIT_OUT_CAP, HELPER_TAIL_CAP, DEPLOY_OUT_CAP stay with them).
// A leaf like every other module here: node/bun globals and nothing else, never server.ts.

// --- what a capped run log must still be able to SAY -------------------------------------------
// Both places that store a command's output (this gate's `verify.out` and the post-land audit
// row's `out`) used to build `out + err` and keep the last N *chars*. Measured cost of that on the
// only two RED audit rows on record (2026-07-26, data-audit-2026-07-27 item 6): 4096 chars kept,
// 33 result lines, ALL of them PASS, plus the trailing "6 FAILURES". The suite prints `FAIL <name>`
// interleaved among ~860 checks and only the COUNT at the end, so a tail-slice keeps the 4% that
// says nothing — WHICH checks failed on that run is unrecoverable from any artifact. The same
// defect sat on the verify gate, where a red run that cannot name its failing check is worse.
// So retention here is signal-first, not position-first:
//   · stdout and stderr are kept as SEPARATE labelled sections. Concatenate-then-tail-slice let a
//     chatty stderr silently displace the entire stdout verdict, and nothing enforces a quiet
//     stderr — a stderr flood is exactly what a broken run produces.
//   · inside a section the failure-shaped lines are taken FIRST (newest first, at most half the
//     budget), then the tail — a verdict/summary lives at the end. Gaps are MARKED, never closed
//     silently: a reader must be able to tell a whole log from a retained window.
//   · the budget is counted in BYTES, which is what the comments always claimed (String.length is
//     UTF-16 code units), and every cut lands on a line or a UTF-8 sequence boundary, so a blind
//     slice can no longer split a surrogate pair.
const FAIL_LINE = /\b(FAIL|FAILED|FAILURES?|ERROR|AssertionError|not ok)\b|^\s*(✗|✘|×|error:)/;
const ELIDE_COST = 32; // an "… [N lines elided]" marker, charged up front so markers cannot bust the cap
const STDERR_MARK = "--- stderr ---";
const utf8 = new TextEncoder();
const utf8Dec = new TextDecoder();
export const byteLen = (s: string): number => utf8.encode(s).length;
// last `budget` BYTES of s, rewound off any continuation byte (0b10xxxxxx) so the cut never lands
// inside a multi-byte sequence — the only place a raw byte slice is still used
function tailBytes(s: string, budget: number): string {
  if (budget <= 0) return "";
  const b = utf8.encode(s);
  if (b.length <= budget) return s;
  let start = b.length - budget;
  while (start < b.length && (b[start]! & 0xc0) === 0x80) start++;
  return utf8Dec.decode(b.subarray(start));
}
function retainSection(text: string, budget: number): string {
  if (budget <= 0) return "";
  if (byteLen(text) <= budget) return text;
  const lines = text.split("\n");
  const cost = lines.map((l) => byteLen(l) + 1); // +1: the newline that rejoins it
  const keep = new Set<number>();
  let used = ELIDE_COST; // the one gap the tail always leaves under the failure lines
  const take = (i: number, reserveGap: boolean): boolean => {
    if (keep.has(i)) return true;
    if (used + cost[i]! + (reserveGap ? ELIDE_COST : 0) > budget) return false;
    keep.add(i);
    used += cost[i]! + (reserveGap ? ELIDE_COST : 0);
    return true;
  };
  const half = Math.floor(budget / 2);
  for (let i = lines.length - 1; i >= 0 && used < half; i--) if (FAIL_LINE.test(lines[i]!)) take(i, true);
  for (let i = lines.length - 1; i >= 0; i--) if (!take(i, false)) break;
  const idx = [...keep].sort((a, b) => a - b);
  if (!idx.length) return tailBytes(text, budget); // one line longer than the whole budget
  const elide = (n: number): string => `… [${n} line${n === 1 ? "" : "s"} elided]`;
  const parts: string[] = [];
  let prev = -1;
  for (const i of idx) {
    if (i > prev + 1) parts.push(elide(i - prev - 1));
    parts.push(lines[i]!);
    prev = i;
  }
  if (prev < lines.length - 1) parts.push(elide(lines.length - 1 - prev));
  return parts.join("\n");
}
// The one retention both capture sites use. Returns a single string (the stored field stays a
// string), but stdout and stderr are separated by a marker line instead of run together.
export function retainRunOutput(out: string, err: string, cap: number): string {
  if (!err.trim()) return retainSection(out, cap);
  if (!out.trim()) return retainSection(err, cap);
  const budget = Math.max(0, cap - byteLen(STDERR_MARK) - 2);
  // stderr gets a QUARTER of the budget unless it is smaller; whatever stdout does not use flows
  // back to it. The asymmetry is the point: the verdict is on stdout.
  const errBudget = Math.min(byteLen(err), Math.max(Math.floor(budget / 4), Math.min(256, budget)));
  const keptOut = retainSection(out, budget - errBudget);
  const keptErr = retainSection(err, budget - byteLen(keptOut));
  return `${keptOut}\n${STDERR_MARK}\n${keptErr}`;
}

// A signal sent to the process this server spawned reaches THAT process and nothing under it —
// and on Linux that process is not the verify chain. `sh -c "<one simple command>"` is EXEC'd by
// macOS's /bin/sh (bash's last-command optimisation) but FORKED by dash, so the staffel in fire()
// below was terminating a shell with the whole chain still running underneath it, holding the
// inherited stdout pipe open. Measured 2026-08-30 on the Debian 13 second-host: a gate whose wait
// budget expired after 5 000 ms returned at 30 015 ms — the stand-in's own exit — which is exactly
// the "server blocked on an answer it has promised never to use" that the staffel exists to end.
//
// The descendants are collected BEFORE the parent is signalled: an orphan reparents to init and
// `pgrep -P` can no longer name it. Depth-bounded and pid-deduped — this walks the tree of a
// process we have already decided to kill, never the machine.
const KILL_TREE_MAX_DEPTH = 8;
export async function descendantPids(root: number): Promise<number[]> {
  const found: number[] = [];
  let level = [root];
  for (let depth = 0; depth < KILL_TREE_MAX_DEPTH && level.length > 0; depth++) {
    const next: number[] = [];
    for (const pid of level) {
      const g = Bun.spawn(["pgrep", "-P", String(pid)], { stdout: "pipe", stderr: "ignore" });
      const out = await new Response(g.stdout).text();
      await g.exited;
      for (const line of out.split("\n")) {
        const kid = Number(line.trim());
        if (kid > 0 && kid !== root && !found.includes(kid)) { found.push(kid); next.push(kid); }
      }
    }
    level = next;
  }
  return found;
}
// The pid list a staffel signals is taken ONCE, by its FIRST stage, and both stages then signal
// that same list. Re-walking at the SIGKILL stage finds nothing: the parent is already gone by
// then and its children have reparented to init, where `pgrep -P <dead parent>` can no longer name
// them. That is not hypothetical — a chain that IGNORES the term (`trap '' TERM`, the shape a real
// gate has while blocked in `wait`) survived the whole staffel that way, which is the very case
// the escalation exists for.
export async function killProcessTree(
  p: { pid: number; kill(sig?: number): void }, sig: number, tree: Promise<number[]>,
): Promise<void> {
  const kids = await tree;
  try { p.kill(sig); } catch { /* already gone */ }
  for (const kid of kids) { try { process.kill(kid, sig); } catch { /* already gone */ } }
}
