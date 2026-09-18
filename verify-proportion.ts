// Local proof is deliberately conservative: an empty or unfamiliar footprint expands to the
// full local chain, because a fast answer is useful only when it is also honest. The local
// recommendation is advisory; the authoritative server gate uses this same classification for
// its docs-only short chain and otherwise runs its full configured chain.

import { modulesForPaths } from "./suite-modules";

export const LOCAL_PROOF_STEPS = [
  "install",
  "pins",
  "tsc",
  "build",
  "clean-review",
  "security",
  "claude-gate",
] as const;

export type LocalProofStep = (typeof LOCAL_PROOF_STEPS)[number];
// A CLARIFY lane builds nothing: its brief ends in filing the criterion through this route, then
// STOP (CLAUDE.md, Lane discipline). Its honest verify is therefore this route, not a chain step —
// named beside the chain, never inside it, because the gate runs LOCAL_PROOF_STEPS and not this.
export const CLARIFY_CLOSE_ROUTE = "POST /api/self/criterion";
export type IsolatedPreview = true | false | "self-assess";
export interface LocalProof {
  steps: LocalProofStep[];
  isolatedPreview: IsolatedPreview;
  classifiedAs: Record<string, string>;
  // WHY THE LIST ABOVE IS EMPTY, and the only case in which it may be. Every name in
  // LOCAL_PROOF_STEPS is a line of THIS repo's chain (`bun e2e/pins.ts`, `bun run build`,
  // `./e2e-security.sh`), so in a repo that does not run that chain the honest recommendation is
  // no steps at all plus the command that repo's own gate will run. Neither function in this file
  // ever sets it — the classifier is repo-blind by design and answers about PATHS; the repo lock
  // lives at the gate seam (server.ts#laneLocalProof, the same `repoRunsShortChain` the gate's own
  // command selection asks). Absent therefore means "these steps are this repo's own", never
  // "no note was computed".
  note?: string;
  // WHICH CHECK MODULES this footprint is about, for a lane that wants the isolated preview NARROWED
  // (`FLEET_E2E_MODULES=<these>`; the runner adds the transitive fixture closure and prints it).
  // Advisory, and present only where narrowing is honest: absent means "no narrowing", which is the
  // answer for every footprint that is not entirely check modules — one file the map cannot place
  // (server.ts, a wrapper, e2e/harness.ts) can change what any module measures.
  // It never narrows the authoritative gate: the land gate's chain does not run that runner at all,
  // and the post-land audit's child environment drops every FLEET_* variable (e2e/pins.ts holds
  // both). A filtered run is a PREVIEW — docs/verify-tiering.md §16.
  modules?: string[];
}

export interface VerificationProportion extends LocalProof {
  proportional: boolean;
}

const DOC_STEPS: readonly LocalProofStep[] = ["install", "pins"];
const SOURCE_STEPS: readonly LocalProofStep[] = ["install", "pins", "tsc", "build"];

type Rule = {
  label: string;
  steps: readonly LocalProofStep[];
  isolatedPreview: IsolatedPreview;
};

const DOC_RULE: Rule = { label: "docs-or-prose", steps: DOC_STEPS, isolatedPreview: false };
const SOURCE_RULE: Rule = { label: "source-or-public", steps: SOURCE_STEPS, isolatedPreview: false };
const E2E_RULE: Rule = { label: "e2e-or-merge-land", steps: LOCAL_PROOF_STEPS, isolatedPreview: true };
const SERVER_RULE: Rule = { label: "server-or-host-runtime", steps: LOCAL_PROOF_STEPS, isolatedPreview: "self-assess" };
const DEFAULT_RULE: Rule = { label: "conservative-default", steps: LOCAL_PROOF_STEPS, isolatedPreview: "self-assess" };

function ruleFor(path: string): Rule {
  if (path.startsWith("docs/") || path.startsWith("briefs/") || path.startsWith("drops/")
    || path.startsWith("attic/")
    || (!path.includes("/") && path.endsWith(".md")) || path === ".gitignore") return DOC_RULE;

  if (path.startsWith("src/") || path.startsWith("public/")) return SOURCE_RULE;

  if (path.startsWith("e2e/") || /^e2e-.*\.sh$/.test(path) || /^fleet-e2e.*\.ts$/.test(path)
    || path === "merge-prompt.ts" || path === "clarify-prompt.ts") return E2E_RULE;

  // `server/` is where the split puts server modules, and it is read as SERVER everywhere in this
  // repo (plan-2026-08-31 §Randbedingung 2) — the prefix lives here BEFORE the first module moves,
  // because an unlisted one would silently fall to DEFAULT_RULE and shift the gate's burden of
  // proof without anything saying so. The docs block above still wins for a future `server/*.md`.
  if (path === "server.ts" || path.startsWith("server/") || path === "watchdog.sh" || path === "Dockerfile"
    || /^docker-.*\.sh$/.test(path) || path === "container-firewall.sh"
    || path === "state.sh" || path === "register.sh") return SERVER_RULE;

  return DEFAULT_RULE;
}

export function verificationProportionFor(files: string[]): VerificationProportion {
  if (files.length === 0) {
    return { steps: [...LOCAL_PROOF_STEPS], isolatedPreview: "self-assess", classifiedAs: {}, proportional: false };
  }

  const selected = new Set<LocalProofStep>();
  const classifications: [string, string][] = [];
  let isolatedPreview: IsolatedPreview = false;
  let proportional = true;

  for (const file of files) {
    const rule = ruleFor(file);
    classifications.push([file, rule.label]);
    if (rule.label !== DOC_RULE.label) proportional = false;
    for (const step of rule.steps) selected.add(step);
    if (rule.isolatedPreview === true) isolatedPreview = true;
    else if (rule.isolatedPreview === "self-assess" && isolatedPreview === false)
      isolatedPreview = "self-assess";
  }

  // omitted rather than empty when there is nothing to narrow: an empty LIST would read as "no
  // modules are involved", and the absent field is the only honest form of "the whole suite"
  const modules = modulesForPaths(files);
  return {
    steps: LOCAL_PROOF_STEPS.filter((step) => selected.has(step)),
    isolatedPreview,
    classifiedAs: Object.fromEntries(classifications),
    ...(modules ? { modules } : {}),
    proportional,
  };
}

export function localProofFor(files: string[]): LocalProof {
  const { proportional: _, ...proof } = verificationProportionFor(files);
  return proof;
}
