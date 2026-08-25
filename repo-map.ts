// repo-map.ts — the executable map of this repo's top level: every directory, every entry file.
//
// Run `bun repo-map.ts` to render docs/repo-map.generated.md. Same shape as capability-map.ts: the
// render function is pure over gathered facts, only this executable edge writes, and e2e/pins.ts
// calls the same two functions to hold the checked-in document byte-for-byte against this source.
//
// WHY. An agent finds by `rg` only what it can already name. Nothing in this repo named all of its
// top-level directories in one place, so `lerntisch/` and `studio-kit/` appeared in no start-context
// file and `task-waves.ts` in no prose at all (docs/messungen/video-codebase-klarheit-2026-08-25.md
// §2.4). This map is the missing name list — and it is generated, so it cannot rot into a lie.
//
// THE ONE RULE OF ITS CONTENT: a row whose sentence is unavailable renders as a VISIBLE marker, not
// as nothing. Silence is what let a directory go unnamed in the first place; an absent sentence has
// to read as an absent sentence.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

export type RepoMapEntry = { readonly name: string; readonly note: string | null };
export type RepoMapFacts = {
  readonly directories: readonly RepoMapEntry[];
  readonly files: readonly RepoMapEntry[];
};
export type RepoMapProbe = { readonly ok: true; readonly facts: RepoMapFacts } | { readonly ok: false; readonly detail: string };

// A directory has no header comment to read, so its sentence is maintained HERE. That is the whole
// reason the marker below exists: a table a human keeps is a table a human forgets, and the pin has
// to be able to say so. Keys are directory names without the trailing slash.
export const DIRECTORY_NOTES: Readonly<Record<string, string>> = {
  ".claude": "Session-scoped Claude Code commands (`⚙ steward`'s five pulses) and the repo-local skills — `graphify`, `kriterium-grill`, `mess-notiz`, `unslop`.",
  ".fleet": "This repo's own context manifest (`context-packs.json`) — the pointers a target repo publishes about itself, validated by e2e/pins.ts before every land.",
  "arbeitskreis-atlas": "The working-circle atlas: a JSON model of Fleet's own roles and processes plus the single HTML page derived from it — refine the model, the page follows.",
  "briefs": "Founding and task briefs handed to lanes, kept as tracked prose so a dispatched instruction stays readable after its pane is gone.",
  "commands": "Portable prompt-compiler commands (`sharpen`, `gosharp`) — the ones not bound to this checkout's steward role.",
  "docs": "The knowledge shelf: how to brief a session, what a green gate attests, which failures are the machine's — including `docs/messungen/` for tracked measurement notes.",
  "drills": "Fire drills — seeded-defect runs that point a real model at a real path, deliberately outside the deterministic suites.",
  "e2e": "The check modules `fleet-e2e.ts` boots in order, plus `pins.ts`: the must-agree pairs whose other side is not TypeScript.",
  "lerntisch": "The learning bench — agent/information layers measured as data (`daten/`) against captured sources (`quellen/`), with its own HTML view.",
  "public": "Static assets `server.ts` serves: the dashboard, share and landing pages, icons and manifest. The client bundles beside them are gitignored build output.",
  "src": "Modules shared across the server, the browser bundle and the suites — protocol types, the client, share rendering, shell quoting, markdown, backoff.",
  "studio-kit": "The mechanical invariants for setting up a working-circle studio: templates and checklists whose mitigation is a check, never product rules.",
};

const DIRECTORY_MARKER = "**no sentence** — this directory has no entry in `repo-map.ts#DIRECTORY_NOTES`; add one.";
const FILE_MARKER = "**no sentence** — this file opens with no header comment; add one as its first line so this row stops reading as empty.";

// The sentence of a FILE is the file's own first comment line, so it cannot drift from the file.
// A shebang is skipped because every `.sh` here starts with one; nothing past that first comment
// line is parsed — no second source of truth about what a file does.
export function firstCommentLine(source: string): string | null {
  const lines = source.split("\n");
  let index = 0;
  if (lines[0]?.startsWith("#!")) index = 1;
  const line = lines[index];
  if (line === undefined) return null;
  const match = /^\s*(?:\/\/|#)\s?(.*)$/.exec(line);
  if (match === null) return null;
  const note = match[1]!.trim();
  return note === "" ? null : note;
}

// Facts come from git, not from a raw directory read: `node_modules/` appears the moment anyone runs
// `bun install`, and a map that grew a row from an install would not be a map of this repo. Tracked
// AND untracked-but-not-ignored, so a new top-level file counts the moment it is written.
export function collectRepoMap(root: string): RepoMapProbe {
  const ls = spawnSync("git", ["-C", root, "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" }, maxBuffer: 16 * 1024 * 1024 });
  if (ls.error || ls.status !== 0)
    return { ok: false, detail: (ls.error?.message || ls.stderr || `git ls-files exited ${String(ls.status)}`).trim().slice(0, 160) };
  const paths = ls.stdout.split("\0").filter(Boolean);
  if (paths.length === 0) return { ok: false, detail: "git named no paths at all" };

  const directoryNames = [...new Set(paths.filter((p) => p.includes("/")).map((p) => p.slice(0, p.indexOf("/"))))].sort();
  const fileNames = [...new Set(paths.filter((p) => !p.includes("/") && (p.endsWith(".ts") || p.endsWith(".sh"))))].sort();

  const directories = directoryNames.map((name) => ({ name, note: DIRECTORY_NOTES[name] ?? null }));
  const files = fileNames.map((name) => {
    let source: string;
    try { source = readFileSync(resolve(root, name), "utf8"); } catch { return { name, note: null }; }
    return { name, note: firstCommentLine(source) };
  });
  return { ok: true, facts: { directories, files } };
}

export function renderRepoMap(facts: RepoMapFacts): string {
  const out = [
    "# Fleet repo map — top level",
    "",
    "<!-- Generated by `bun repo-map.ts`; do not edit by hand. -->",
    "",
    "The name list an `rg` cannot give you: `rg` finds only what you can already spell. Every top-level",
    "directory this repo carries, and every top-level `.ts`/`.sh` file, with one sentence each.",
    "",
    "Scope and sources, so the omissions are not silent:",
    "",
    "- Entries come from `git ls-files --cached --others --exclude-standard`, so gitignored trees",
    "  (`node_modules/`, `graphify-out/`, `streams/`, `drops/`) never appear and a brand-new file does.",
    "- A directory's sentence is maintained in `repo-map.ts#DIRECTORY_NOTES`.",
    "- A file's sentence is that file's own first comment line, read from the file.",
    "- Top-level files that are not `.ts` or `.sh` are out of scope by design: `README.md`, `AGENTS.md`,",
    "  `SYSTEM.md`, `OWNER.md`, `INTAKE.md`, `SHARING.md`, `HANDOFF.md`, `Dockerfile`, `package.json`,",
    "  `bun.lock`, `launchd-example.plist`, `worker-deepseek.py`, `LICENSE`.",
    "- A row with no sentence available says so in the row. It is never dropped.",
    "",
    `## Directories (${facts.directories.length})`,
    "",
  ];
  for (const entry of facts.directories) out.push(`- \`${entry.name}/\` — ${entry.note ?? DIRECTORY_MARKER}`);

  out.push("", `## Top-level \`.ts\` and \`.sh\` files (${facts.files.length})`, "");
  for (const entry of facts.files) out.push(`- \`${entry.name}\` — ${entry.note ?? FILE_MARKER}`);

  out.push("");
  return out.join("\n");
}

if (import.meta.main) {
  const probe = collectRepoMap(import.meta.dir);
  if (!probe.ok) { console.error(`repo-map: could not gather facts — ${probe.detail}`); process.exit(1); }
  writeFileSync(resolve(import.meta.dir, "docs/repo-map.generated.md"), renderRepoMap(probe.facts));
  console.log(`repo-map: ${probe.facts.directories.length} directories, ${probe.facts.files.length} files -> docs/repo-map.generated.md`);
}
