# AGENTS.md — the short rulebook that travels

`docs/verfassung.md` is the top layer (its §10): this file is derived from it, cites its paragraphs
as §1–§10 and may not contradict it; only the owner changes it. Claude Fleet is a local control
plane for coding-agent sessions in tmux panes (§1). A "lane" is a throwaway working copy of this
repo; you are probably one. Work only your slice.

**Loader boundary.** This file owns the required portable contract. Codex and Pi load it
automatically; a Claude session reads the **Portable operating contract** once, because its loader
supplies `CLAUDE.md`: a git-ignored private overlay for host- and audience-specific reality. MAIN
receives its full render, a Fleet lane a smaller render plus explicit back-references. It is no
second portable core, and Codex/Pi must not read it wholesale — only a section that a brief or an
observed host seam names.

For facts, code and live sensors outrank prose (§9); for rules, the constitution outranks this
contract, and this contract outranks global defaults. The overlay may specialize but never weaken a
hard invariant; a brief narrows work but cannot supply a missing invariant. Report a remaining
contradiction instead of picking the convenient rule.

## Lane contract

`## Portable operating contract`, `## Verify`, `## Landing` and `## Reporting` stand in
`.fleet/vertraege/lane.md`; Fleet carries them from there into the session file of every lane, MAIN
and Orchestratorin (`context-packs.ts#CONTEXT_PACKS`).

## A red check is yours

"Looks like a known flake" is not proof; running the SAME tree again is (green proves
non-determinism), and the transcript goes in your report either way. On fresh work suspect your
PROBE first: a check that measures nothing looks like broken code, and a value the code cannot
produce dates your measurement. A probe that could not run fails as ITSELF, under its own name.
About five identical fix-run-fail loops mean the problem is structural: stop and report.

## Where a test goes

`fleet-e2e.ts` is a RUNNER only: a check joins its family in `e2e/<family>.ts`, plumbing lives in
`e2e/harness.ts`, shared fixtures in `e2e/ctx.ts`. `e2e/pins.ts` holds must-agree pairs whose
other half is not TypeScript — a RULE, never a snapshot, no server. A rule fed only by the source
checkout's untracked state uses `pinSource` (`SRC-FAIL`, printed but uncounted outside it).

## How a check is written

One check, one claim; the detail names the conjunct that died. An exactness invariant carries no
tolerance unless one code sentence names the clock it forgives. A synthetic timeline lives as a
table (t | event | exclusive owner) beside its literals. A policy exception or dual-mode filter is
a NAMED predicate (`suiteRestartedSrv`), never a shape proxy (`results.length > N`). A source
anchor that counts code strips whole-line comments first (the `fleet-e2e-security.ts` §7 filter):
a commented-out line still satisfies an exact string anchor, so the check passes a line that is
gone — count over the filtered code and let a mutation prove the check can fail.

E2E-Fixtures: `e2e/harness.ts#post` ersetzt seine Standard-Header durch eigene Header; diese brauchen `content-type: application/json` (`server.ts#readJson`). Leere Verzeichnisse werden nicht in Git-Lanes uebernommen: benoetigte Pfade in der Lane anlegen (`e2e/verify-rules.ts#run`).

## If you are a Codex or Pi lane

You have full local access (since 2026-08-12): edit, commit, reach the Fleet API and run the full
Verify list. A mechanically refused command is a signal, not a waiver: quote the error verbatim,
and never report a skipped step as passed.

Three host rules that otherwise live only in the private lane overlay, which a Codex lane does not load:

- Never print a process command line unfiltered (`ps`, `pgrep -af` and relatives), because every
  pane's shell string exports its self-credentials — count with `grep -c` or `cut -c1-40` first.
- Never start `bun server.ts` with its default environment, because the defaults are the live tmux
  socket, port and fleet.json — verify through `./e2e-isolated.sh`, which brings its own.
- Search git-ignored files with `rg -uu` or `grep`, because plain `rg` honours `.gitignore` and
  returns an empty result for CLAUDE.md, fleet.json, the ledgers and .env.

A lane of this repo reads the main checkout's code graph at `graphify-out/graph.json`, a read-only
link the server lays at spawn (`server.ts#linkLaneGraph`), with no `--graph`. Ask it for a symbol's
neighbourhood before grepping a large file: `graphify explain "<symbol>"` lists callers and callees
with `file:line` in about a second, `graphify path "<A>" "<B>"` joins two symbols; the card's
NACHBARN lines are that answer, read at filing. The free-text `graphify query` mostly returns
Markdown headings here and is optional. Never `graphify update`, `graphify .` or `save-result` in a
lane: `update` refuses there by construction, and a lane-built graph dies with the worktree. No graph
(an older lane, a foreign repo) is normal: use `rg`/`ast-grep`.
