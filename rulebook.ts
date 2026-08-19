// HOW TO CHANGE A RULE, now that CLAUDE.md is a GENERAT: edit the FRAGMENT, then re-render. A hand
// edit to CLAUDE.md is lost at the next render and reds e2e/pins.ts section 6b in the meantime, so
// the recipe belongs next to the module the failing rule names. From the main checkout root:
//
//   bun -e 'import{RULEBOOK_FRAGMENTS as F,RULEBOOK_DIR as d,fragmentFileName as n,renderRulebook as r}from"./rulebook";import{readFileSync as R,writeFileSync as W}from"node:fs";W("CLAUDE.md",r("main",new Map(F.map(f=>[f,R(`${d}/${n(f)}`,"utf8")]))))'
//
// It is idempotent: run against an untouched rulebook/ it rewrites the same bytes.
//
// The rulebook is seven fragments, not one file. This module is the pure half of that split: it
// owns the fragment vocabulary, who gets which fragments, and the assembly order — and it reads
// NOTHING. Contents are handed in, the way context-plan.ts and verify-proportion.ts are built,
// because the caller is the only side that knows which checkout it is allowed to read.
//
// The assembly is byte-exact by construction: `renderRulebook("main", …)` of the seven fragments
// reproduces CLAUDE.md, so a split that lost or reordered a rule cannot pass. That equality is the
// whole reason the fragments may be believed at all, and e2e/pins.ts fastens it.

/** Who a rendered rulebook is FOR. A lane is briefed for one slice of work; a MAIN session steers. */
export const RULEBOOK_AUDIENCES = ["lane", "main"] as const;
export type RulebookAudience = (typeof RULEBOOK_AUDIENCES)[number];

/** The seven fragments, in the order they are assembled. The order IS the contract. */
export const RULEBOOK_FRAGMENTS = [
  "loader",
  "einstieg",
  "lane-discipline",
  "supervisor",
  "self-scheduling",
  "deploy",
  "graphify",
] as const;
export type RulebookFragment = (typeof RULEBOOK_FRAGMENTS)[number];

/**
 * PARTITION, never overlap: a rule lives in exactly one fragment. Two fragments carrying the same
 * rule would give the loader contract a second contradiction surface — the one thing it is written
 * to stop work over.
 */
export const FRAGMENTS_FOR: Record<RulebookAudience, readonly RulebookFragment[]> = {
  lane: ["loader", "lane-discipline", "self-scheduling"],
  main: [...RULEBOOK_FRAGMENTS],
};

/** The id prefix of the meaning probe IS the fragment — no per-rule judgement is involved. */
export const FRAGMENT_BY_RULE_PREFIX: Record<string, RulebookFragment> = {
  L: "loader",
  E: "einstieg",
  D: "lane-discipline",
  S: "supervisor",
  F: "self-scheduling",
  P: "deploy",
  G: "graphify",
};

/** Directory of the fragment files, relative to a checkout root. Gitignored, like CLAUDE.md itself. */
export const RULEBOOK_DIR = "rulebook";
export const fragmentFileName = (f: RulebookFragment): string => `${f}.md`;

// The document title, and the only line no fragment owns.
export const RULEBOOK_PREAMBLE = "# claude-fleet\n";

/**
 * Assemble the fragments for one audience. Throws on a missing or empty fragment rather than
 * rendering a rulebook with a hole in it — a short rulebook reads exactly like a complete one.
 */
export function renderRulebook(
  audience: RulebookAudience,
  contents: ReadonlyMap<RulebookFragment, string>,
): string {
  let out = RULEBOOK_PREAMBLE;
  for (const f of FRAGMENTS_FOR[audience]) {
    const body = contents.get(f);
    if (body === undefined || body.trim() === "") throw new Error(`rulebook fragment missing or empty: ${f}`);
    // one blank line between sections, exactly one trailing newline per fragment
    out += `\n${body.replace(/\n+$/, "")}\n`;
  }
  return out;
}
