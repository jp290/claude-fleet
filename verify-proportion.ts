// Local proof is deliberately conservative: an empty or unfamiliar footprint expands to the
// full local chain, because a fast answer is useful only when it is also honest. This module is
// advisory; the server-side land gate remains authoritative and always runs its configured chain.

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
export type IsolatedPreview = true | false | "self-assess";
export interface LocalProof {
  steps: LocalProofStep[];
  isolatedPreview: IsolatedPreview;
  classifiedAs: Record<string, string>;
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
    || (!path.includes("/") && path.endsWith(".md")) || path === ".gitignore") return DOC_RULE;

  if (path.startsWith("src/") || path.startsWith("public/")) return SOURCE_RULE;

  if (path.startsWith("e2e/") || /^e2e-.*\.sh$/.test(path) || /^fleet-e2e.*\.ts$/.test(path)
    || path === "merge-prompt.ts" || path === "clarify-prompt.ts") return E2E_RULE;

  if (path === "server.ts" || path === "watchdog.sh" || path === "Dockerfile"
    || /^docker-.*\.sh$/.test(path) || path === "container-firewall.sh"
    || path === "state.sh" || path === "register.sh") return SERVER_RULE;

  return DEFAULT_RULE;
}

export function localProofFor(files: string[]): LocalProof {
  if (files.length === 0) {
    return { steps: [...LOCAL_PROOF_STEPS], isolatedPreview: "self-assess", classifiedAs: {} };
  }

  const selected = new Set<LocalProofStep>();
  const classifications: [string, string][] = [];
  let isolatedPreview: IsolatedPreview = false;

  for (const file of files) {
    const rule = ruleFor(file);
    classifications.push([file, rule.label]);
    for (const step of rule.steps) selected.add(step);
    if (rule.isolatedPreview === true) isolatedPreview = true;
    else if (rule.isolatedPreview === "self-assess" && isolatedPreview === false)
      isolatedPreview = "self-assess";
  }

  return {
    steps: LOCAL_PROOF_STEPS.filter((step) => selected.has(step)),
    isolatedPreview,
    classifiedAs: Object.fromEntries(classifications),
  };
}
