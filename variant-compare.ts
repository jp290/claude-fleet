// T4 · THE VARIANT COMPARISON — the LEDGER ROW and the STAGE RULE, pure (server.ts#tickVariantCompare
// measures, this file decides and shapes). Criterion owner-confirmed at 1ed2f6a0, carried verbatim in
// queue row 68a45516; the lane that builds it is Fleet-Betrieb's variant-group row.
//
// The row shape is binding prose, so it is a type here and nowhere else:
//   {group, variants[{taskId,branch,harness,model,effort,klasse:null,done:[{part,result,source}],
//    gate,diff}], winner, decidedAt, judge:null}
//   · result: met | unmet | unmeasured — source: check | report
//   · gate: green | red | unknown | not-run
//   · diff: {lines, files} — a diff that could NOT be measured is {-1,-1}, a named sentinel, never
//     a fake 0 (a fake 0 would WIN the smaller-diff stage on evidence nobody measured)
//   · decidedAt names the STAGE that decided — "done"|"gate"|"diff"|"order" — not a clock reading;
//     the time lives on the group's marker (Task.variantCompare.at) and the file's mtime
//   · judge stays null (A3: no model judge in this lane); klasse stays null (A4: the class register
//     is a different row's work)
//
// THE STAGE RULE, verbatim from the criterion:
//   Stage 1 — more met, counting ONLY source:"check" entries; a report's claim is NOTED (its own
//     entry) and never counted.
//   Stage 2 — the land gate run without merge, ONLY for those tied after stage 1; green beats
//     everything, and unknown/waitedOut (and red, and not-run) is NO WIN.
//   Stage 3 — the smaller measured diff, only among those still tied; an unmeasurable diff
//     ({-1,-1}) never wins.
//   Stage 4 — the filing order (variantIndex): the decision must exist, so a full tie falls to
//     order rather than to nobody.

export type VariantDoneResult = "met" | "unmet" | "unmeasured";
export type VariantDoneSource = "check" | "report";
export type VariantGate = "green" | "red" | "unknown" | "not-run";
export type VariantDecidedAt = "done" | "gate" | "diff" | "order";

export interface VariantDoneEntry { part: string; result: VariantDoneResult; source: VariantDoneSource }
export interface VariantDiffStat { lines: number; files: number }
export interface VariantCompareVariant {
  taskId: string; branch: string; harness: string | null; model: string | null; effort: string | null;
  klasse: null; done: VariantDoneEntry[]; gate: VariantGate; diff: VariantDiffStat;
}
export interface VariantCompareRow {
  group: string; variants: VariantCompareVariant[]; winner: string;
  decidedAt: VariantDecidedAt; judge: null;
}

// what the comparator measured about ONE variant before the stages run
export interface VariantStageCandidate {
  taskId: string; index: number;
  met: number;              // stage 1 — only source:"check" met entries (countCheckedMet)
  gate: VariantGate;        // stage 2 — "not-run" until the server ran the gate for this variant
  diff: VariantDiffStat | null; // stage 3 — null = not measurable, never wins
}

export const UNMEASURED_DIFF: VariantDiffStat = { lines: -1, files: -1 };

// THE LEDGER ENTRIES for one variant, over the CONFIRMED criterion's parts. `checks` holds the
// server-executed results (source "check"); `claims` holds the part texts the variant's own report
// claims — noted, never counted. A part with neither stands as unmeasured with source "report":
// the report channel is the only non-check source the ledger knows, and "consulted, claimed
// nothing" is exactly what that entry says. A criterion that is NOT owner-confirmed contributes
// NO parts at all — the server executed nothing, so the ledger names nothing.
export function doneEntriesFor(parts: readonly { text: string }[] | undefined,
  checks: ReadonlyMap<string, VariantDoneResult>, claims: ReadonlySet<string>): VariantDoneEntry[] {
  const out: VariantDoneEntry[] = [];
  for (const p of parts ?? []) {
    const ran = checks.get(p.text);
    if (ran) out.push({ part: p.text, result: ran, source: "check" });
    if (claims.has(p.text)) out.push({ part: p.text, result: "met", source: "report" });
    if (!ran && !claims.has(p.text)) out.push({ part: p.text, result: "unmeasured", source: "report" });
  }
  return out;
}

// stage 1 — the entries a variant's met count comes from
export const countCheckedMet = (entries: readonly VariantDoneEntry[]): number =>
  entries.filter((e) => e.source === "check" && e.result === "met").length;

// STAGE 1 alone: who is still tied after counting checked met. The server needs the tie set
// BEFORE stage 2 (the gate runs only for these), which is why it is exported separately —
// decideVariantCompare then finishes the rule over the same candidates, gates filled in.
export function stageOneTied(cands: readonly VariantStageCandidate[]): VariantStageCandidate[] {
  if (!cands.length) return [];
  const max = Math.max(...cands.map((c) => c.met));
  return cands.filter((c) => c.met === max);
}

// THE FULL RULE over measured candidates. Gates must already be filled for every stage-1 tie
// member ("not-run" is a value like any other and never wins stage 2).
export function decideVariantCompare(cands: readonly VariantStageCandidate[]):
  { winner: string; stage: VariantDecidedAt } | null {
  if (!cands.length) return null;
  let tied = stageOneTied(cands);
  if (tied.length === 1) return { winner: tied[0].taskId, stage: "done" };
  // stage 2 — green beats the rest of the tie; unknown/waitedOut/red/not-run win nothing here.
  const greens = tied.filter((c) => c.gate === "green");
  if (greens.length === 1) return { winner: greens[0].taskId, stage: "gate" };
  if (greens.length > 1) tied = greens;
  // stage 3 — the smaller MEASURED diff, lines first, files as the second key.
  const measurable = tied.filter((c) => c.diff !== null && c.diff.lines >= 0 && c.diff.files >= 0);
  if (measurable.length) {
    const minLines = Math.min(...measurable.map((c) => c.diff!.lines));
    let smallest = measurable.filter((c) => c.diff!.lines === minLines);
    if (smallest.length > 1) {
      const minFiles = Math.min(...smallest.map((c) => c.diff!.files));
      smallest = smallest.filter((c) => c.diff!.files === minFiles);
    }
    if (smallest.length === 1) return { winner: smallest[0].taskId, stage: "diff" };
  }
  // stage 4 — the filing order decides; a comparison that ends in a full tie still ends.
  const ordered = [...tied].sort((a, b) => a.index - b.index);
  return { winner: ordered[0].taskId, stage: "order" };
}

// THE ONE LINE, in the binding field shape — built here so the shape and the rule cannot drift.
export function buildVariantCompareRow(group: string, variants: VariantCompareVariant[],
  winner: string, stage: VariantDecidedAt): VariantCompareRow {
  return { group, variants, winner, decidedAt: stage, judge: null };
}
