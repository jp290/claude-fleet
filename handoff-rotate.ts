// handoff-rotate.ts — keeps HANDOFF.md's top `#` section and appends every other one, byte for byte, to docs/attic.
//
//   bun handoff-rotate.ts --dry-run    names the kept section and every section that would move
//   bun handoff-rotate.ts              moves them: HANDOFF.md keeps the top, the rest is APPENDED to
//                                      docs/attic/handoff-archiv-<YYYY-MM-DD>.md, in source order
//   --root <dir>  --date <YYYY-MM-DD>  what the pin in e2e/pins.ts drives it with (fixture dir, fixed date)
//
// WHY. Every succession prepends a section and the successor reads only the top one, so nobody ever
// removes anything: 572 KB and 380 headings on 2026-09-13, after one hand rotation on 2026-09-05
// (docs/attic/handoff-archiv-2026-09-05.md). This makes that hand rotation one command.
//
// THE ONE PROMISE: bytes of HANDOFF.md before = bytes after + bytes appended to the archive. No
// header, no separator, no re-encoding — the file is sliced as bytes, so a section comes back out of
// the archive exactly as it went in. The script never commits; the MAIN commits what it changed.
// A heading inside a fenced code block is not a section boundary.
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// state.sh prints its rotate line above this size; e2e/pins.ts holds the two numbers together
export const HANDOFF_WARN_KB = 64;

export type HandoffSection = { readonly start: number; readonly end: number; readonly heading: string };
export type HandoffSplit = { readonly keepEnd: number; readonly kept: HandoffSection | null; readonly archived: readonly HandoffSection[] };

// latin1 maps every byte to one code unit, so string offsets ARE byte offsets and nothing re-encodes
export function splitHandoff(bytes: Uint8Array): HandoffSplit {
  const text = Buffer.from(bytes).toString("latin1");
  const starts: number[] = [];
  let fence: { char: string; len: number } | null = null;
  for (let at = 0; at < text.length;) {
    const nl = text.indexOf("\n", at);
    const lineEnd = nl === -1 ? text.length : nl;
    const line = text.slice(at, lineEnd);
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence !== null) {
      if (marker && marker[1]![0] === fence.char && marker[1]!.length >= fence.len && /^ {0,3}(`+|~+)[ \t\r]*$/.test(line)) fence = null;
    } else if (marker) {
      fence = { char: marker[1]![0]!, len: marker[1]!.length };
    } else if (/^ {0,3}#(?:[ \t\r]|$)/.test(line)) {
      starts.push(at);
    }
    at = lineEnd + 1;
  }
  const sections = starts.map((start, i): HandoffSection => {
    const end = starts[i + 1] ?? bytes.length;
    const nl = text.indexOf("\n", start);
    const heading = Buffer.from(bytes.subarray(start, nl === -1 || nl > end ? end : nl)).toString("utf8").trimEnd();
    return { start, end, heading };
  });
  const [kept, ...archived] = sections;
  return { keepEnd: archived[0]?.start ?? bytes.length, kept: kept ?? null, archived };
}

function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fail(message: string): never {
  process.stderr.write(`handoff-rotate: ${message}\n`);
  process.exit(2);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  let dryRun = false;
  let rootArg: string | null = null;
  let dateArg: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--dry-run") dryRun = true;
    else if (a === "--root" || a === "--date") {
      const v = args[++i];
      if (v === undefined || v.startsWith("--")) fail(`${a} needs a value`);
      if (a === "--root") rootArg = v; else dateArg = v;
    } else fail(`unknown argument ${a}`);
  }
  const root = resolve(rootArg ?? import.meta.dir);
  const date = dateArg ?? localDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(`--date must be YYYY-MM-DD, got ${date}`);

  const handoffPath = `${root}/HANDOFF.md`;
  const archiveRel = `docs/attic/handoff-archiv-${date}.md`;
  const archivePath = `${root}/${archiveRel}`;
  if (!existsSync(handoffPath)) fail(`${handoffPath} not found`);
  const before = readFileSync(handoffPath);
  const split = splitHandoff(before);
  const moved = before.length - split.keepEnd;

  console.log(`HANDOFF.md ${before.length} B, ${split.archived.length + (split.kept ? 1 : 0)} # section(s)`);
  console.log(`  keep     ${split.keepEnd} B  ${split.kept?.heading ?? "(no # heading — nothing to rotate)"}`);
  for (const s of split.archived) console.log(`  archive  ${s.end - s.start} B  ${s.heading}`);
  if (split.archived.length === 0) {
    console.log("nothing to rotate");
    process.exit(0);
  }
  console.log(`${dryRun ? "would append" : "appending"} ${moved} B to ${archiveRel}`);
  if (dryRun) process.exit(0);

  const archiveBefore = existsSync(archivePath) ? statSync(archivePath).size : 0;
  // appending "# …" behind a last line without its newline would glue the heading onto that line
  if (archiveBefore > 0 && readFileSync(archivePath).at(-1) !== 0x0a)
    fail(`${archiveRel} does not end with a newline — appending would merge a heading into its last line`);
  // archive first: a crash between the two writes leaves a duplicate, never a loss
  mkdirSync(`${root}/docs/attic`, { recursive: true });
  appendFileSync(archivePath, before.subarray(split.keepEnd));
  writeFileSync(handoffPath, before.subarray(0, split.keepEnd));
  const after = statSync(handoffPath).size;
  const appended = statSync(archivePath).size - archiveBefore;
  if (after + appended !== before.length)
    fail(`byte check failed: ${before.length} B before, ${after} B kept + ${appended} B appended`);
  console.log(`done: ${after} B kept + ${appended} B appended = ${before.length} B — nothing committed`);
}
