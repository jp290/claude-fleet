// Deterministic acceptance on a ↻ refine PROPOSAL — what a machine can say about a compiled brief
// before the owner confirms it, without a model and without reading the tree itself.
//
// WHY (docs/attic/brief-kompilierung-verbesserung-2026-08-18.md §6). The refiner's prompt carries the
// clause ONLY VERIFIED PATHS — "every path you name must come from your own ls, Read or Glob"
// (refine-prompt.ts) — and a hallucinated path is the one MEASURED failure class the brief for
// that worker names. Until now that clause was a self-commitment of the model and nothing else:
// parseRefineAnswer clamps field lengths and the child count and checks no path against any tree,
// no verify field against any contract. This module is the other half. It does not replace the
// prompt clause and must not be read as licence to weaken it — it AUDITS what the clause promises.
//
// It is also the precondition for the compiler role being fillable from outside: a bought brief
// arrives without the tree it claims to have read, so "are these paths real, is this verify path
// one of ours" is the whole of what the owner can still check for free.
//
// PURE, in the shape of validateContextPacks and localProofFor beside it: every fact is injected,
// there is no filesystem, git, env or network read here, and NOT MEASURED IS NEVER A PASS — an
// index that could not be read degrades to `unknown`, never to a clean bill.
//
// ADVISORY, and deliberately so: nothing here blocks a confirm. Refine is propose/promote, the
// promote is the owner's act, and he keeps the same latitude the land path grants him — this makes
// a bad proposal VISIBLE, never impossible.
import { LOCAL_PROOF_STEPS, type LocalProofStep } from "./verify-proportion";

export const REFINE_FINDING_CODES = [
  "CHILD_UNGROUNDED",
  "PATH_NOT_TRACKED",
  "PATH_UNCHECKABLE",
  "VERIFY_CONTRACT_FOREIGN",
  "VERIFY_MISSING",
  "VERIFY_OFF_CONTRACT",
  "VERIFY_TREE_UNKNOWN",
] as const;
export type RefineFindingCode = (typeof REFINE_FINDING_CODES)[number];

// Which tree the proposal is about, in dispatchSourceTree's vocabulary. `null` is not a third tree
// — it means the identity could not be established, and that is why it can never yield a verdict.
export type RefineTree = "fleet" | "foreign" | null;

export interface RefineChildFacts {
  readonly files: readonly string[];
  readonly verify: string;
}

export interface RefineValidationInput {
  readonly children: readonly RefineChildFacts[];
  // The target repo's tracked paths, or `null` when its index could not be read. `null` and an
  // EMPTY set say different things and must never collapse: an empty set is a repository that
  // tracks nothing (every declared path is then genuinely absent), `null` is no measurement.
  readonly trackedPaths: ReadonlySet<string> | null;
  readonly tree: RefineTree;
}

export interface RefineFinding {
  readonly code: RefineFindingCode;
  readonly severity: "error" | "unknown";
  readonly child: number; // 0-based index into the proposal's children, so a reader can point
  readonly detail: string;
  readonly path?: string;
  readonly verify?: string;
}

export interface RefineValidation {
  readonly verdict: "pass" | "fail" | "unknown";
  readonly findings: readonly RefineFinding[];
}

// How a verify field NAMES a step of the local proof chain. Typed against LocalProofStep on
// purpose: adding a step to LOCAL_PROOF_STEPS stops compiling here until someone says how that
// step is recognised, which is the only structural guard against this vocabulary silently
// falling behind the chain it claims to speak for.
//
// `e2e-isolated.sh` is in the set although it is not a STEP, and the reason is in the same module:
// LocalProof declares `isolatedPreview` beside `steps` as part of one contract (verify-proportion
// .ts), and it is this repo's most-named verification path. Flagging it would have made the
// validator's first real finding a false one — and a validator that cries wolf on the common case
// teaches the owner to skip the whole column.
const STEP_MARKERS: Readonly<Record<LocalProofStep, readonly string[]>> = {
  install: ["bun install"],
  pins: ["e2e/pins.ts"],
  tsc: ["tsc"],
  build: ["bun run build"],
  "clean-review": ["e2e-clean-review.sh"],
  security: ["e2e-security.sh"],
  "claude-gate": ["e2e-claude-gate.sh"],
};
const ISOLATED_PREVIEW_MARKER = "e2e-isolated.sh";

// compiled once, not per call: this runs inside taskView, which the 2 s sessions poll drives over
// every row that carries a proposal
const STEP_WORD: readonly (readonly [LocalProofStep, RegExp])[] =
  LOCAL_PROOF_STEPS.map((step) => [step, new RegExp(`(^|[^a-z0-9-])${step}([^a-z0-9-]|$)`)] as const);

// Recognition is deliberately GENEROUS — the marker, or the bare step name as a whole word. The
// error direction matters: a missed bad verify costs one unflagged row, a false flag on a good one
// costs the mechanism's credibility. What stays flagged is a field that names nothing of the chain
// at all ("test it in the browser", "npm test"), which is exactly the off-contract case §6 means.
export function verifyNamesLocalProof(verify: string): boolean {
  const text = verify.toLowerCase();
  if (text.includes(ISOLATED_PREVIEW_MARKER)) return true;
  return STEP_WORD.some(([step, word]) =>
    STEP_MARKERS[step].some((marker) => text.includes(marker)) || word.test(text));
}

export function validateRefineProposal(input: RefineValidationInput): RefineValidation {
  const findings: RefineFinding[] = [];
  const emit = (
    code: RefineFindingCode, severity: "error" | "unknown", child: number, detail: string,
    extra: Partial<Pick<RefineFinding, "path" | "verify">> = {},
  ): void => { findings.push({ code, severity, child, detail, ...extra }); };

  const tracked = input.trackedPaths; // bound once: narrowing does not reach into the closures below

  for (let child = 0; child < input.children.length; child++) {
    const kid = input.children[child];

    // (1) every path the child NAMES, against the target repo's tracked set. A child that names no
    // path produces no path finding: "declares nothing" is a different statement from "declares
    // something false", and only the second is this validator's business.
    for (const path of kid.files) {
      if (tracked === null)
        emit("PATH_UNCHECKABLE", "unknown", child, "the target repo's tracked paths could not be read", { path });
      else if (!tracked.has(path))
        emit("PATH_NOT_TRACKED", "error", child, `not tracked in the target repo: ${path}`, { path });
    }
    // …and the degree, said once, because it is a different statement about the compiler. One bad
    // path among five is a typo or a file that moved; five of five is a child written without the
    // tree open, and that is the whole failure mode ONLY VERIFIED PATHS exists to prevent. Emitted
    // only where the tracked set was actually read — otherwise "all of them are absent" would be a
    // claim about a measurement that never happened.
    if (tracked !== null && kid.files.length > 0 && kid.files.every((path) => !tracked.has(path)))
      emit("CHILD_UNGROUNDED", "error", child,
        `none of the ${kid.files.length} path(s) this child names exists in the target repo`);

    // (2) the verify field, against LOCAL_PROOF_STEPS — but only where that chain describes the
    // tree in question. A task may target a foreign repo, where this vocabulary means nothing;
    // judging it there would be inventing a contract, so the outcome is NOT RATEABLE and says so.
    const verify = kid.verify.trim();
    if (!verify) emit("VERIFY_MISSING", "error", child, "the child names no verification at all");
    else if (input.tree === null)
      emit("VERIFY_TREE_UNKNOWN", "unknown", child,
        "the target tree could not be identified, so no verify contract applies to it", { verify });
    else if (input.tree === "foreign")
      emit("VERIFY_CONTRACT_FOREIGN", "unknown", child,
        "the target repo is not Fleet — LOCAL_PROOF_STEPS says nothing about its verification", { verify });
    else if (!verifyNamesLocalProof(verify))
      emit("VERIFY_OFF_CONTRACT", "error", child,
        `names no step of the local proof chain (${LOCAL_PROOF_STEPS.join(", ")}): ${verify}`, { verify });
  }

  // stable order, like the pack validator's: by child, then code, then the value it points at, so
  // a diff of two runs shows what MOVED rather than how the loops happened to interleave
  const order = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
  findings.sort((a, b) => a.child - b.child || order(a.code, b.code)
    || order(a.path ?? "", b.path ?? "") || order(a.verify ?? "", b.verify ?? "")
    || order(a.detail, b.detail));

  const verdict = findings.some((f) => f.severity === "error") ? "fail"
    : findings.some((f) => f.severity === "unknown") ? "unknown" : "pass";
  return { verdict, findings };
}
