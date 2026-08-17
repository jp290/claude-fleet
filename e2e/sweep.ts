// The deterministic cleanliness sweep (review-sweep.ts, plan WP3/WP3′), proved against PREPARED
// trees rather than against this repo. Two fixtures, because one of them is the half that catches a
// sensor rotting into an all-clear:
//
//   · the POSITIVE fixture plants exactly one instance of each check family, each next to its own
//     negative control (an inline-literal cast beside the named one, a live doc anchor beside the
//     dead one, an exported TYPE beside the exported value, an exactly-800-line file beside the
//     801-line one). A check that fires on the control is as broken as one that misses the finding.
//   · the CLEAN fixture is a git repo with none of the shapes, and it must terminate green with
//     zero findings — the portability half of WP3′: no Fleet path, so nothing to find.
//
// THE QUEUE HALF NEVER TOUCHES THE LIVE FLEET, and that is asserted rather than assumed: e2e/harness
// refuses to load against the live socket/port at all, the endpoint handed to the CLI is this
// throwaway instance's BASE, and every row this module mints it also deletes, so the queue is left
// exactly as it was found (owner constraint 2026-08-17).
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { BASE, ROOT, TOKEN, check, get, post } from "./harness";
import { SIZE_LIMIT_LINES, SWEEP_MARK, sweep, type Finding } from "../review-sweep";

const TMP = `${process.env.TMPDIR ?? "/tmp"}/fleet-sweep-fixtures-${process.pid}`;

const put = (root: string, rel: string, body: string): void => {
  mkdirSync(`${root}/${dirname(rel)}`, { recursive: true });
  writeFileSync(`${root}/${rel}`, body);
};

const gitStage = (root: string): void => {
  for (const args of [["init", "-q"], ["add", "-A"]]) {
    const p = Bun.spawnSync(["git", ...args], { cwd: root });
    if (!p.success) throw new Error(`fixture git ${args[0]} failed in ${root}: ${p.stderr.toString()}`);
  }
};

// n lines exactly (the file's line count as review-sweep counts it: split("\n").length)
const lines = (n: number, note: string): string => `// ${note}\n${"//\n".repeat(n - 2)}`;

function positiveFixture(root: string): void {
  put(root, ".gitignore", "ignored.json\n");
  put(root, "exact-limit.ts", lines(SIZE_LIMIT_LINES, "exactly at the limit — the boundary control"));
  put(root, "over-limit.ts", lines(SIZE_LIMIT_LINES + 1, "one line over the limit — the finding"));
  put(root, "top.ts", [
    "export const usedConstant = 2;",
    "export type UnusedShape = { a: number };",
    "export const unusedConstant = 1;",
    "",
  ].join("\n"));
  // THE SPECIFIER IS DELIBERATELY NOT RELATIVE, and this is not cosmetic: e2e-stage.sh derives every
  // instance's file set from import-anchored relative specifiers in the staged sources, and it treats
  // a specifier that resolves to no file as FATAL. A fixture STRING whose specifier began with a dot
  // stopped the whole isolated suite at staging time, before a single check ran — the trap that file
  // documents for fleet-e2e-security.ts's hostile-branch-name list, sprung by this module's first
  // run. And the same scan reads COMMENTS, so this paragraph may not spell the offending form out
  // either: a dotted specifier anywhere in this file, quoted or explained, is chased. Fixture sources
  // are never compiled; what the dead-export control needs is only that the name appears in another
  // tracked module.
  put(root, "src/api.ts", [
    `import { usedConstant } from "@fixture/top";`,
    "type Payload = { a: number };",
    "export async function load(u: string): Promise<number> {",
    "  const res = await fetch(u);",
    "  const named = (await res.json()) as Payload;",
    "  const inline = (await res.json()) as { a: number };",
    "  return named.a + inline.a + usedConstant;",
    "}",
    "",
  ].join("\n"));
  put(root, "docs/notes.md", [
    "# fixture doc",
    "",
    "Live path: `src/api.ts`.",
    "Dead path: `src/gone.ts`.",
    "Ignored path: `ignored.json`.",
    "Live symbol: `unusedConstant`.",
    "Dead symbol: `vanishedHelper`.",
    "",
  ].join("\n"));
  gitStage(root);
}

function cleanFixture(root: string): void {
  put(root, "small.ts", "const one = 1;\nexport const two = one + 1;\n");
  put(root, "src/use.ts", `import { two } from "@fixture/small";\nexport const three = two + 1;\n`);
  put(root, "docs/clean.md", "Everything cited here exists: `small.ts`, `src/use.ts`.\n");
  gitStage(root);
}

const has = (fs: Finding[], check: string, file: string, key = ""): boolean =>
  fs.some((f) => f.check === check && f.file === file && f.key === key);
const shape = (fs: Finding[]): string =>
  fs.map((f) => `${f.check}:${f.file}${f.key ? `#${f.key}` : ""}`).sort().join(" ");

export async function run(): Promise<void> {
  const pos = `${TMP}/positive`;
  const clean = `${TMP}/clean`;
  mkdirSync(pos, { recursive: true });
  mkdirSync(clean, { recursive: true });
  positiveFixture(pos);
  cleanFixture(clean);

  // ── the guarantee the owner asked for, stated as a check rather than as a comment ──────────────
  check("sweep: the queue target of these checks is not the live fleet",
    !BASE.includes(":8790") && BASE.startsWith("http://"), `BASE=${BASE}`);

  // ── §1 the positive fixture: one finding per family, each with its control ────────────────────
  const found = (await sweep({ root: pos })).findings;
  const errors = (await sweep({ root: pos })).errors;
  // ast-grep is the cast check's own precondition. Asserted separately so that "the tool is
  // missing" can never be read off a silent zero in the cast rows below.
  check("sweep: ast-grep answered for the cast family", errors.length === 0,
    errors.map((e) => `${e.check}: ${e.message}`).join("; ") || "no errors");

  check("sweep: the positive fixture yields exactly the five planted findings", found.length === 5, shape(found));
  check("sweep: a tracked file one line over the limit is reported",
    has(found, "size", "over-limit.ts"),
    found.filter((f) => f.check === "size").map((f) => f.detail).join(" | "));
  check(`sweep: a file of exactly ${SIZE_LIMIT_LINES} lines is not reported`,
    !has(found, "size", "exact-limit.ts"), shape(found));
  check("sweep: a json result cast to a named type is reported once for the file",
    found.filter((f) => f.check === "cast").length === 1 && has(found, "cast", "src/api.ts"),
    found.filter((f) => f.check === "cast").map((f) => f.detail).join(" | "));
  check("sweep: the same file's inline-literal cast is not a second finding",
    (found.find((f) => f.check === "cast")?.detail ?? "").includes("Payload")
    && !(found.find((f) => f.check === "cast")?.detail ?? "").includes("{"),
    found.find((f) => f.check === "cast")?.detail ?? "no cast finding");
  check("sweep: a doc path that resolves to nothing is reported",
    has(found, "doc-anchor", "docs/notes.md", "src/gone.ts"), shape(found));
  check("sweep: a doc path that resolves, and a git-ignored one, are both left alone",
    !has(found, "doc-anchor", "docs/notes.md", "src/api.ts")
    && !has(found, "doc-anchor", "docs/notes.md", "ignored.json"), shape(found));
  check("sweep: a cited symbol that exists in no tracked source is reported",
    has(found, "doc-anchor", "docs/notes.md", "vanishedHelper"), shape(found));
  check("sweep: a cited symbol that does exist is left alone",
    !has(found, "doc-anchor", "docs/notes.md", "unusedConstant"), shape(found));
  check("sweep: an exported value with no import site is reported",
    has(found, "dead-export", "top.ts", "unusedConstant"), shape(found));
  check("sweep: an imported value and an exported type are both left alone",
    !has(found, "dead-export", "top.ts", "usedConstant")
    && !has(found, "dead-export", "top.ts", "UnusedShape"), shape(found));

  // ── §2 the same tree twice, and the same tree with every line moved ───────────────────────────
  const again = (await sweep({ root: pos })).findings;
  check("sweep: two runs over one tree emit byte-identical findings",
    JSON.stringify(again) === JSON.stringify(found), `${again.length} vs ${found.length} findings`);

  // pure line movement: three blank lines in front of every file that carries a located finding.
  // The fingerprints must be unchanged (that is what makes --queue idempotent across edits), and at
  // least one reported LINE must have moved — otherwise this check proves nothing about movement.
  for (const rel of ["src/api.ts", "docs/notes.md", "top.ts", "over-limit.ts"]) {
    const body = await Bun.file(`${pos}/${rel}`).text();
    put(pos, rel, `\n\n\n${body}`);
  }
  gitStage(pos);
  const moved = (await sweep({ root: pos })).findings;
  const fpsBefore = found.map((f) => f.fingerprint).sort().join(",");
  const fpsAfter = moved.map((f) => f.fingerprint).sort().join(",");
  const linesMoved = moved.filter((f) => f.line !== null)
    .some((f) => f.line !== found.find((g) => g.fingerprint === f.fingerprint)?.line);
  check("sweep: a fingerprint survives pure line movement",
    fpsBefore === fpsAfter && linesMoved && moved.length === found.length,
    `moved=${linesMoved} before=[${fpsBefore}] after=[${fpsAfter}]`);

  // ── §3 the clean fixture: portability, and zero findings as a real answer ─────────────────────
  const cleanRun = await sweep({ root: clean });
  check("sweep: a repo with none of the shapes terminates with zero findings and no failed check",
    cleanRun.findings.length === 0 && cleanRun.errors.length === 0,
    `${shape(cleanRun.findings)} errors=[${cleanRun.errors.map((e) => e.check).join(",")}]`);
  const noRepo = await sweep({ root: TMP });
  check("sweep: a directory that is no git repository is an error, never an all-clear",
    noRepo.errors.length === 1 && noRepo.errors[0]!.check === "tree" && noRepo.findings.length === 0,
    JSON.stringify(noRepo.errors));

  // ── §4 the CLI: exit codes, the refusals, and a check that could not run ──────────────────────
  const cli = async (args: string[], env: Record<string, string> = {}): Promise<{ out: string; err: string; code: number }> => {
    const p = Bun.spawn([process.execPath, `${ROOT}/review-sweep.ts`, ...args], {
      cwd: ROOT, stdout: "pipe", stderr: "pipe",
      env: { ...process.env, ...env },
    });
    const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
    return { out, err, code: await p.exited };
  };

  const clean0 = await cli(["--root", clean]);
  check("sweep cli: a clean tree exits 0 and its summary says zero findings",
    clean0.code === 0 && clean0.out.includes(`"findings":0`), `exit=${clean0.code} ${clean0.out.trim().split("\n").pop()}`);
  const posRun = await cli(["--root", pos]);
  check("sweep cli: a tree with findings still exits 0 — this is a sensor, not a gate",
    posRun.code === 0 && posRun.out.includes(`"findings":5`), `exit=${posRun.code} ${posRun.out.trim().split("\n").pop()}`);

  // A check whose tool is absent must fail AS ITSELF. `PATH` is stripped to the system directories,
  // which keeps git (/usr/bin/git) and loses ast-grep (~/.local/bin).
  const noTool = await cli(["--root", pos, "--only", "cast"], { PATH: "/usr/bin:/bin" });
  check("sweep cli: a check that cannot run reports itself and exits 2, never zero findings",
    noTool.code === 2 && noTool.out.includes(`"kind":"error"`) && noTool.out.includes(`"checksThatCouldNotRun":["cast"]`),
    `exit=${noTool.code} ${noTool.out.trim().split("\n").join(" ")}`.slice(0, 240));

  const before = ((await (await get("/api/tasks")).json()) as { tasks: { id: string }[] }).tasks.length;
  const noApi = await cli(["--root", pos, "--queue"]);
  const noTok = await cli(["--root", pos, "--queue", "--api", BASE]);
  check("sweep cli: --queue without an endpoint refuses loudly and mints nothing",
    noApi.code === 2 && noApi.err.includes("--api") && !noApi.out.includes(`"kind":"minted"`),
    `exit=${noApi.code} ${noApi.err.trim()}`);
  check("sweep cli: --queue without a credential refuses loudly and mints nothing",
    noTok.code === 2 && noTok.err.includes("--token") && !noTok.out.includes(`"kind":"minted"`),
    `exit=${noTok.code} ${noTok.err.trim()}`);
  const stillBefore = ((await (await get("/api/tasks")).json()) as { tasks: { id: string }[] }).tasks.length;
  check("sweep cli: neither refusal reached the queue", stillBefore === before, `${before} -> ${stillBefore}`);

  // ── §5 --queue against THIS instance: one notiz per new finding, and nothing the second time ──
  const first = await cli(["--root", pos, "--queue", "--api", BASE, "--token", TOKEN]);
  const mintedIds = [...first.out.matchAll(/"kind":"minted","fingerprint":"([0-9a-f]+)","taskId":"([0-9a-z]+)"/g)];
  check("sweep cli: --queue mints one row per finding through the owner task API",
    first.code === 0 && mintedIds.length === moved.length,
    `exit=${first.code} minted=${mintedIds.length} findings=${moved.length}`);

  type Row = { id: string; text?: string; kind?: string; status?: string; source?: string; releasedBy?: string };
  const rowsAfter = ((await (await get("/api/tasks")).json()) as { tasks: Row[] }).tasks;
  const mine = rowsAfter.filter((r) => (r.text ?? "").includes(`[${SWEEP_MARK} `));
  check("sweep cli: every minted row is an unreleased notiz carrying its fingerprint",
    mine.length === mintedIds.length && mine.length > 0
    && mine.every((r) => r.kind === "notiz" && r.status === "pending" && r.releasedBy === undefined),
    mine.map((r) => `${r.id}:${r.kind}/${r.status}`).join(" "));

  const second = await cli(["--root", pos, "--queue", "--api", BASE, "--token", TOKEN]);
  const rowsSecond = ((await (await get("/api/tasks")).json()) as { tasks: Row[] }).tasks
    .filter((r) => (r.text ?? "").includes(`[${SWEEP_MARK} `));
  check("sweep cli: a second --queue run on an unchanged tree mints nothing",
    second.code === 0 && !second.out.includes(`"kind":"minted"`)
    && second.out.includes(`"skipped":${mine.length}`) && rowsSecond.length === mine.length,
    `exit=${second.code} rows=${rowsSecond.length} ${second.out.trim().split("\n").pop()}`);

  // A finding whose note the owner has closed is mintable again — the finding is still in the tree,
  // so re-reporting it is the honest behaviour, and the dedup must be over OPEN rows only.
  const closed = mine[0]!;
  await post(`/api/tasks/${closed.id}/done`, {});
  const third = await cli(["--root", pos, "--queue", "--api", BASE, "--token", TOKEN]);
  const remint = [...third.out.matchAll(/"kind":"minted","fingerprint":"([0-9a-f]+)","taskId":"([0-9a-z]+)"/g)];
  check("sweep cli: a finding whose row was closed is reported again, not swallowed",
    third.code === 0 && remint.length === 1, `${remint.length} re-minted, ${third.out.trim().split("\n").pop()}`);

  // ── §6 leave the queue as we found it ────────────────────────────────────────────────────────
  for (const r of ((await (await get("/api/tasks")).json()) as { tasks: Row[] }).tasks)
    if ((r.text ?? "").includes(`[${SWEEP_MARK} `)) await post(`/api/tasks/${r.id}/delete`, {});
  const after = ((await (await get("/api/tasks")).json()) as { tasks: { id: string }[] }).tasks.length;
  check("sweep: the queue is left exactly as it was found", after === before, `${before} -> ${after}`);

  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true });
}
