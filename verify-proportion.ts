// Local proof is deliberately conservative: an empty or unfamiliar footprint expands to the
// full local chain, because a fast answer is useful only when it is also honest. The local
// recommendation is advisory; the authoritative server gate uses this same classification
// (gateChainFor below): a docs-only diff runs install+pins, a diff of only `src/`, `public/` and
// docs runs install, pins, tsc, build plus the gate suites whose staged footprint it touches,
// and everything else — including every footprint nobody could derive — the full configured chain.

import { gateSuitesForPaths, modulesForPaths, modulePlanFor, type FootprintEvidence, type FootprintCoverage, type GateSuiteStep, type ModulePlan, type TreeReader } from "./suite-modules";

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
  // File-only classification names check modules; gate context replaces that advice with the
  // exact preview selection, including modulePlanFor's transitive fixture closure. Absent means
  // the full suite or no owed preview. This never narrows the authoritative gate or audit.
  modules?: string[];
  preview?: PreviewRecommendation;
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
  if (path === "server.ts" || path.startsWith("server/") || path === "watchdog.sh" || path === "ops/Dockerfile"
    || /^ops\/docker-.*\.sh$/.test(path) || path === "ops/container-firewall.sh"
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

// THE LAND GATE'S CLASS — which chain the server runs for a candidate, and the word the land note
// stamps beside `steps` (server.ts#verifyPlanFor). Three values and no fourth, because each names a
// command: `docs-or-prose` the short install+pins chain, `source-or-public` the configured chain
// with the gate suites cut that no changed path reaches, `full` the configured chain untouched.
// `full` is also every answer this function cannot give honestly: an empty diff, a path of any other
// rule (e2e/, server.ts, server/, watchdog.sh — and DEFAULT_RULE, whose files nobody classified),
// and a source diff whose suite footprint could not be derived. Absence buys the full chain.
export type GateClass = "docs-or-prose" | "source-or-public" | "full";
export interface GateChain {
  class: GateClass;
  steps: LocalProofStep[];
  /** source-or-public only: per suite it keeps, the changed paths in that suite's footprint */
  owedBy?: Partial<Record<GateSuiteStep, string[]>>;
}

export function gateChainFor(files: string[], read: TreeReader): GateChain {
  const full: GateChain = { class: "full", steps: [...LOCAL_PROOF_STEPS] };
  const proportion = verificationProportionFor(files);
  if (proportion.proportional) return { class: "docs-or-prose", steps: proportion.steps };
  const code = files.filter((file) => ruleFor(file) !== DOC_RULE);
  if (!code.length || !code.every((file) => ruleFor(file) === SOURCE_RULE)) return full;
  const suites = gateSuitesForPaths(code, read);
  if (!suites) return full;
  return {
    class: "source-or-public",
    steps: LOCAL_PROOF_STEPS.filter((step) => SOURCE_STEPS.includes(step)
      || (suites.owed as readonly string[]).includes(step)),
    owedBy: suites.why,
  };
}

export type LandTarget =
  | { state: "known"; branch: string; sha: string; via: "laneBaseRef" }
  | { state: "unknown"; reason: string; via: "laneBaseRef" };
export interface LocalProofContext {
  target: LandTarget;
  diff?: { baseSha: string; headSha: string; treeSha: string };
  footprint: FootprintEvidence;
}
export interface PreviewRecommendation {
  default: "none" | "full" | "modules";
  reason: string;
  target: LandTarget;
  diff?: LocalProofContext["diff"];
  coverage: FootprintCoverage;
  plan?: ModulePlan;
}

export function localProofFor(files: string[], context?: LocalProofContext): LocalProof {
  const { proportional: _, ...proof } = verificationProportionFor(files);
  // File-only callers retain the classifier contract; the gate always supplies an explicit target,
  // including unknown. No saved target metadata or environment switch grants narrowing.
  if (!context) return proof;
  const { modules: _modules, ...local } = proof;
  const paths = files.filter((file) => proof.classifiedAs[file] !== DOC_RULE.label);
  const coverage = modulesForPaths(paths, context.footprint);
  const plan = coverage.state === "covered" ? modulePlanFor(coverage.named) : undefined;
  const preview: PreviewRecommendation = {
    default: "full", reason: "", target: context.target,
    ...(context.diff ? { diff: context.diff } : {}), coverage,
    ...(plan ? { plan } : {}),
  };
  if (proof.isolatedPreview === false) {
    preview.default = "none";
    preview.reason = "no isolated preview owed by this footprint";
  } else if (context.target.state === "unknown") {
    preview.reason = `unknown land target: ${context.target.reason}; full conservative fallback`;
  } else if (context.target.branch === "main") {
    preview.reason = "main-bound preview: full suite before promotion";
  } else if (coverage.state !== "covered") {
    preview.reason = `uncovered footprint: ${coverage.reasons.join("; ")}; full conservative fallback`;
  } else if (!plan || plan.unknown.length || plan.unresolved.length || !plan.run.length) {
    preview.reason = "fixture closure is unresolved; full conservative fallback";
  } else {
    preview.default = "modules";
    preview.reason = `non-main target ${context.target.branch}: every changed source has a check anchor; transitive fixture closure applied`;
    return { ...local, modules: plan.run, preview };
  }
  return { ...local, preview };
}
